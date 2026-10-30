import { describe, expect, it } from "vitest";
import {
	forbiddenPackages,
	type Manifest,
	overBudget,
	packagesInSources,
	routePreloads,
	totalSize,
} from "./measure";

const manifest: Manifest = {
	routes: {
		__root__: {
			children: ["/(auth)", "/"],
			preloads: ["/assets/index.js", "/assets/shared.js"],
		},
		"/(auth)": {
			children: ["/(auth)/login"],
			preloads: ["/assets/auth.js", "/assets/shared.js"],
		},
		"/(auth)/login": { preloads: ["/assets/login.js"] },
		"/": {},
	},
};

describe("routePreloads", () => {
	it("adds every ancestor's preloads once, root first", () => {
		expect(routePreloads(manifest, "/(auth)/login")).toEqual([
			"/assets/index.js",
			"/assets/shared.js",
			"/assets/auth.js",
			"/assets/login.js",
		]);
	});

	it("handles routes with no preloads of their own", () => {
		expect(routePreloads(manifest, "/")).toEqual([
			"/assets/index.js",
			"/assets/shared.js",
		]);
	});

	it("fails loudly on a route the manifest lacks", () => {
		expect(() => routePreloads(manifest, "/missing")).toThrow(/missing/);
	});
});

describe("totalSize", () => {
	it("sums minified and gzipped bytes", () => {
		const sizes: Record<string, { min: number; gzip: number }> = {
			a: { min: 10, gzip: 4 },
			b: { min: 20, gzip: 6 },
		};
		expect(
			totalSize(["a", "b"], (f) => sizes[f] ?? { min: 0, gzip: 0 }),
		).toEqual({ min: 30, gzip: 10 });
	});
});

describe("overBudget", () => {
	it("lists only measurements above their budget", () => {
		const over = overBudget([
			{ name: "fits", bytes: 100, unit: "gzip", budget: 100 },
			{ name: "too big", bytes: 101, unit: "gzip", budget: 100 },
		]);
		expect(over.map((m) => m.name)).toEqual(["too big"]);
	});
});

describe("packagesInSources", () => {
	it("reads plain and scoped package names from source-map paths", () => {
		const packages = packagesInSources([
			"../../../node_modules/dexie/dist/dexie.mjs",
			"../../../node_modules/@ai-sdk/google/dist/index.mjs",
			"../../../node_modules/.bun/gsap@3.13.0/node_modules/gsap/index.js",
			"../../../src/lib/chat/chat-sessions.ts",
		]);
		expect([...packages].sort()).toEqual(["@ai-sdk/google", "dexie", "gsap"]);
	});
});

describe("forbiddenPackages", () => {
	it("matches exact names and whole scopes", () => {
		const found = forbiddenPackages(
			new Set(["@ai-sdk/google", "dexie", "react", "gsap-like"]),
			["@ai-sdk/", "dexie", "gsap"],
		);
		expect(found).toEqual(["@ai-sdk/google", "dexie"]);
	});
});
