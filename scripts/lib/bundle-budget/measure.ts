// Pure helpers for scripts/bundle-budget.ts: which files a route preloads, what they weigh, and what
// the budget says. File reads and gzip happen in the script, so these stay easy to test.

export type ManifestRoute = {
	children?: string[];
	preloads?: string[];
	css?: string[];
};

export type Manifest = { routes: Record<string, ManifestRoute> };

export type FileSize = { min: number; gzip: number };

export const ROOT_ROUTE = "__root__";

/** Parent of every route, from the manifest's `children` lists. */
export function parentsOf(manifest: Manifest): Map<string, string> {
	const parents = new Map<string, string>();
	for (const [id, route] of Object.entries(manifest.routes)) {
		for (const child of route.children ?? []) parents.set(child, id);
	}
	return parents;
}

/** JS files the browser preloads to show a route: its own and every ancestor's, without duplicates. */
export function routePreloads(manifest: Manifest, routeId: string): string[] {
	if (!manifest.routes[routeId]) {
		throw new Error(`Route ${routeId} isn't in the Start manifest.`);
	}
	const parents = parentsOf(manifest);
	const chain: string[] = [];
	for (let id: string | undefined = routeId; id; id = parents.get(id)) {
		chain.unshift(id);
	}
	const files = new Set<string>();
	for (const id of chain) {
		for (const file of manifest.routes[id]?.preloads ?? []) files.add(file);
	}
	return [...files];
}

export function totalSize(
	files: readonly string[],
	sizeOf: (file: string) => FileSize,
): FileSize {
	return files.reduce(
		(sum, file) => {
			const size = sizeOf(file);
			return { min: sum.min + size.min, gzip: sum.gzip + size.gzip };
		},
		{ min: 0, gzip: 0 },
	);
}

export type Measurement = {
	name: string;
	/** Bytes measured: gzipped or minified, as `unit` says. */
	bytes: number;
	unit: "gzip" | "min";
	budget: number;
	detail?: string;
};

export function overBudget(measurements: readonly Measurement[]) {
	return measurements.filter((m) => m.bytes > m.budget);
}

const KB = 1024;

export function formatKb(bytes: number): string {
	return `${(bytes / KB).toFixed(1)} KB`;
}

export function formatTable(measurements: readonly Measurement[]): string {
	const rows = measurements.map((m) => {
		const status = m.bytes > m.budget ? "OVER" : "ok";
		const detail = m.detail ? `  (${m.detail})` : "";
		return `${status.padEnd(5)}${m.name.padEnd(36)}${formatKb(m.bytes).padStart(10)} ${m.unit.padEnd(5)}/ ${formatKb(m.budget).padStart(10)}${detail}`;
	});
	return rows.join("\n");
}

/**
 * Packages a source map says a chunk contains, from its `sources` paths
 * ("../../node_modules/@ai-sdk/google/dist/index.mjs" → "@ai-sdk/google").
 */
export function packagesInSources(sources: readonly string[]): Set<string> {
	const packages = new Set<string>();
	for (const source of sources) {
		const match = /.*node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(source);
		if (match?.[1]) packages.add(match[1]);
	}
	return packages;
}

/** Forbidden entries a set of packages contains. An entry ending in "/" matches a whole scope. */
export function forbiddenPackages(
	packages: ReadonlySet<string>,
	forbidden: readonly string[],
): string[] {
	return [...packages]
		.filter((name) =>
			forbidden.some((rule) =>
				rule.endsWith("/") ? name.startsWith(rule) : name === rule,
			),
		)
		.sort();
}
