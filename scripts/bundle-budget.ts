// Bundle-size budget (quality audit 2026-10, slice 1). Run after `bun run build`:
//
//   bun scripts/bundle-budget.ts
//
// Reads each route's preloads from the TanStack Start manifest in .vercel/output, gzips the files in
// .vercel/output/static/assets, and exits 1 when a measure is over its budget. When the build has
// source maps (`bun run build --sourcemap`, as CI does), it also checks that the root and /login
// preloads contain none of the chat-only packages.
//
// Raise a budget only on purpose, and say why in the PR.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import {
	type FileSize,
	forbiddenPackages,
	formatTable,
	type Manifest,
	type Measurement,
	overBudget,
	packagesInSources,
	ROOT_ROUTE,
	routePreloads,
	totalSize,
} from "./lib/bundle-budget/measure";

const KB = 1024;
const OUTPUT = path.resolve(".vercel/output");
const STATIC = path.join(OUTPUT, "static");
const ASSETS = path.join(STATIC, "assets");
const SERVER_FUNCTION = path.join(OUTPUT, "functions/__server.func");

// Gzipped KB unless the name says minified. Set after slice 1 from what it reached (root 189, /login 229,
// /new 557, /settings 340, largest chunk 370, scene 897, CSS 23), with a few percent of headroom.
// /settings raised to 370 by 3.11's Appearance section (it reached 355).
const BUDGET_KB = {
	root: 195,
	login: 240,
	new: 580,
	settings: 370,
	largestEagerChunkMin: 400,
	sceneChunkMin: 950,
	css: 24,
};

const PAGES = [
	{
		name: "Root preloads (every page)",
		route: ROOT_ROUTE,
		budget: BUDGET_KB.root,
	},
	{ name: "/login", route: "/(auth)/login", budget: BUDGET_KB.login },
	{ name: "/new", route: "/(dashboard)/new", budget: BUDGET_KB.new },
	{
		name: "/settings",
		route: "/(dashboard)/settings",
		budget: BUDGET_KB.settings,
	},
] as const;

// Chat-only packages that must not load before a chat does.
const CHAT_ONLY_PACKAGES = ["@ai-sdk/", "ai", "dexie", "gsap", "streamdown"];
const LEAN_ROUTES = [ROOT_ROUTE, "/(auth)/login"];

async function loadManifest(): Promise<Manifest> {
	if (!existsSync(SERVER_FUNCTION)) {
		throw new Error(
			`No build at ${SERVER_FUNCTION}. Run \`bun run build\` first.`,
		);
	}
	const file = readdirSync(SERVER_FUNCTION).find((name) =>
		/^_tanstack-start-manifest_v-.*\.mjs$/.test(name),
	);
	if (!file) throw new Error(`No Start manifest in ${SERVER_FUNCTION}.`);
	const module: { tsrStartManifest?: () => Manifest } = await import(
		pathToFileURL(path.join(SERVER_FUNCTION, file)).href
	);
	if (typeof module.tsrStartManifest !== "function") {
		throw new Error(`${file} doesn't export tsrStartManifest.`);
	}
	return module.tsrStartManifest();
}

const sizes = new Map<string, FileSize>();
function sizeOf(publicPath: string): FileSize {
	const cached = sizes.get(publicPath);
	if (cached) return cached;
	const bytes = readFileSync(path.join(STATIC, publicPath));
	const size = { min: bytes.length, gzip: gzipSync(bytes).length };
	sizes.set(publicPath, size);
	return size;
}

function assetFiles(extension: string): string[] {
	return readdirSync(ASSETS)
		.filter((name) => name.endsWith(extension))
		.map((name) => `/assets/${name}`);
}

function measure(manifest: Manifest): Measurement[] {
	const pages = PAGES.map((page) => {
		const files = routePreloads(manifest, page.route);
		return {
			name: page.name,
			bytes: totalSize(files, sizeOf).gzip,
			unit: "gzip" as const,
			budget: page.budget * KB,
			detail: `${files.length} files, ${(totalSize(files, sizeOf).min / KB).toFixed(0)} KB minified`,
		};
	});

	const eager = [
		...new Set(PAGES.flatMap((p) => routePreloads(manifest, p.route))),
	];
	const largest = eager
		.map((file) => ({ file, min: sizeOf(file).min }))
		.sort((a, b) => b.min - a.min)[0];

	const scene = assetFiles(".js").find((file) =>
		/\/scene-[^/]+\.js$/.test(file),
	);

	return [
		...pages,
		{
			name: "Largest preloaded chunk (minified)",
			bytes: largest?.min ?? 0,
			unit: "min",
			budget: BUDGET_KB.largestEagerChunkMin * KB,
			detail: largest?.file,
		},
		{
			name: "Lazy scene chunk (minified)",
			bytes: scene ? sizeOf(scene).min : 0,
			unit: "min",
			budget: BUDGET_KB.sceneChunkMin * KB,
			detail: scene ?? "not found",
		},
		{
			name: "CSS total",
			bytes: totalSize(assetFiles(".css"), sizeOf).gzip,
			unit: "gzip",
			budget: BUDGET_KB.css * KB,
		},
	];
}

/** Chat-only packages found in each lean route's preloads, or null when the build has no source maps. */
function leakedPackages(manifest: Manifest): Map<string, string[]> | null {
	if (assetFiles(".js.map").length === 0) return null;
	const leaks = new Map<string, string[]>();
	for (const route of LEAN_ROUTES) {
		const packages = new Set<string>();
		for (const file of routePreloads(manifest, route)) {
			const mapFile = path.join(STATIC, `${file}.map`);
			if (!existsSync(mapFile)) continue;
			const map: { sources?: string[] } = JSON.parse(
				readFileSync(mapFile, "utf8"),
			);
			for (const name of packagesInSources(map.sources ?? []))
				packages.add(name);
		}
		const found = forbiddenPackages(packages, CHAT_ONLY_PACKAGES);
		if (found.length > 0) leaks.set(route, found);
	}
	return leaks;
}

async function main() {
	const manifest = await loadManifest();
	const measurements = measure(manifest);
	console.log(formatTable(measurements));

	let failed = overBudget(measurements).length > 0;

	const leaks = leakedPackages(manifest);
	if (leaks === null) {
		console.log(
			"\nNo source maps, so the chat-only package check was skipped.",
		);
	} else if (leaks.size === 0) {
		console.log(
			`\nNo chat-only packages (${CHAT_ONLY_PACKAGES.join(", ")}) in root or /login preloads.`,
		);
	} else {
		failed = true;
		for (const [route, found] of leaks) {
			console.error(
				`\n${route} preloads chat-only packages: ${found.join(", ")}`,
			);
		}
	}

	if (failed) {
		console.error("\nBundle budget exceeded. See scripts/bundle-budget.ts.");
		process.exit(1);
	}
}

await main();
