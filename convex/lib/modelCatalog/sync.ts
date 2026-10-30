import {
	HIDDEN_MODEL_PATTERNS,
	MODEL_CURATION,
} from "../../../src/models/curation";
import { diffCatalog, formatDiff } from "./diff";
import {
	applyEndpoints,
	buildCatalog,
	type CatalogSources,
	guardGatewayResult,
	selectEndpointTargets,
} from "./merge";
import {
	ARTIFICIAL_ANALYSIS_KEY_ENV,
	fetchArtificialAnalysisModels,
} from "./sources/artificialAnalysis";
import { fetchGatewayEndpoints, fetchGatewayModels } from "./sources/gateway";
import { runSource, type SourceResult } from "./sources/http";
import { fetchModelsDev } from "./sources/modelsDev";
import { fetchOpenRouterModels } from "./sources/openRouter";
import type { Parsed } from "./sources/parse";
import type { GatewayProvider, ModelRow, SourceRun } from "./validators";

/** Models (besides pins) that get the per-model endpoints call each run. */
export const ENDPOINT_TARGET_LIMIT = 40;
const ENDPOINT_CONCURRENCY = 6;

export type SyncDeps = {
	now: number;
	artificialAnalysisKey: string | undefined;
	previous: readonly ModelRow[];
	log: (line: string) => void;
	warn: (line: string) => void;
};

export type SyncResult = {
	writes: ModelRow[];
	runs: SourceRun[];
	summary: {
		models: number;
		written: number;
		added: number;
		removed: number;
		restored: number;
		changed: number;
	};
};

/** Fetches every source, merges them over the previous catalog, and says what to write. */
export async function runCatalogSync(deps: SyncDeps): Promise<SyncResult> {
	const { previous, now, artificialAnalysisKey } = deps;
	const [gateway, artificialAnalysis, modelsDev, openRouter] =
		await Promise.all([
			runSource(fetchGatewayModels),
			artificialAnalysisKey
				? runSource(() => fetchArtificialAnalysisModels(artificialAnalysisKey))
				: Promise.resolve<SourceResult<Parsed<never>>>({
						ok: false,
						error: `skipped: ${ARTIFICIAL_ANALYSIS_KEY_ENV} is not set`,
					}),
			runSource(fetchModelsDev),
			runSource(fetchOpenRouterModels),
		]);

	const sources: CatalogSources = {
		gateway: guardGatewayResult(items(gateway), previous),
		artificialAnalysis: items(artificialAnalysis),
		modelsDev: modelsDev.ok
			? { ok: true, data: modelsDev.data.ids }
			: modelsDev,
		openRouter: items(openRouter),
	};
	const curation = {
		models: MODEL_CURATION,
		hiddenPatterns: HIDDEN_MODEL_PATTERNS,
	};
	const merged = buildCatalog(previous, sources, curation, now);

	const targets = selectEndpointTargets(merged, ENDPOINT_TARGET_LIMIT);
	const endpointResults = await fetchAllEndpoints(targets);
	const rows = applyEndpoints(merged, endpointResults, now);
	const diff = diffCatalog(previous, rows);

	const runs: SourceRun[] = [
		sourceRun(
			"gateway",
			sources.gateway,
			gateway.ok ? gateway.data.skipped : 0,
		),
		endpointsRun(endpointResults),
		sourceRun(
			"artificialAnalysis",
			sources.artificialAnalysis,
			artificialAnalysis.ok ? artificialAnalysis.data.skipped : 0,
		),
		sourceRun(
			"modelsDev",
			sources.modelsDev,
			0,
			modelsDev.ok ? modelsDev.data.missingProviders : [],
		),
		sourceRun(
			"openRouter",
			sources.openRouter,
			openRouter.ok ? openRouter.data.skipped : 0,
		),
	];
	for (const run of runs) {
		if (!run.ok)
			deps.warn(
				`[models] ${run.source} failed: ${run.error}. Its previous data stays.`,
			);
		else if (run.warning)
			deps.warn(
				`[models] ${run.source}: ${run.itemCount} items; ${run.warning}`,
			);
		else deps.log(`[models] ${run.source}: ${run.itemCount} items`);
	}
	for (const line of formatDiff(diff)) deps.log(`[models] ${line}`);

	return {
		writes: diff.writes,
		runs,
		summary: {
			models: rows.length,
			written: diff.writes.length,
			added: diff.added.length,
			removed: diff.removed.length,
			restored: diff.restored.length,
			changed: diff.changed.length,
		},
	};
}

function items<T>(result: SourceResult<Parsed<T>>): SourceResult<T[]> {
	return result.ok ? { ok: true, data: result.data.items } : result;
}

function sourceRun(
	source: SourceRun["source"],
	result: SourceResult<unknown[] | Record<string, unknown[]>>,
	skipped: number,
	missing: string[] = [],
): SourceRun {
	if (!result.ok) return { source, ok: false, error: result.error };
	const itemCount = Array.isArray(result.data)
		? result.data.length
		: Object.values(result.data).reduce((total, ids) => total + ids.length, 0);
	const warnings = [
		skipped > 0 ? `${skipped} entries failed validation` : "",
		missing.length > 0 ? `no entry for ${missing.join(", ")}` : "",
	].filter(Boolean);
	return withWarning({ source, ok: true, itemCount }, warnings);
}

/** The endpoints source counts as answered when any call succeeded (or none were needed). */
function endpointsRun(
	results: ReadonlyMap<string, SourceResult<GatewayProvider[]>>,
): SourceRun {
	const failures = [...results].flatMap(([gatewayId, result]) =>
		result.ok ? [] : [{ gatewayId, error: result.error }],
	);
	const succeeded = results.size - failures.length;
	if (results.size > 0 && succeeded === 0) {
		return {
			source: "gatewayEndpoints",
			ok: false,
			error: `all ${results.size} calls failed (${failures[0].error})`,
		};
	}
	const failedIds = failures
		.slice(0, 5)
		.map((failure) => failure.gatewayId)
		.join(", ");
	return withWarning(
		{ source: "gatewayEndpoints", ok: true, itemCount: succeeded },
		failures.length > 0
			? [`${failures.length} of ${results.size} calls failed (${failedIds})`]
			: [],
	);
}

function withWarning(run: SourceRun, warnings: string[]): SourceRun {
	return warnings.length > 0 ? { ...run, warning: warnings.join("; ") } : run;
}

async function fetchAllEndpoints(
	gatewayIds: readonly string[],
): Promise<Map<string, SourceResult<GatewayProvider[]>>> {
	const results = new Map<string, SourceResult<GatewayProvider[]>>();
	let next = 0;
	async function worker() {
		while (next < gatewayIds.length) {
			const gatewayId = gatewayIds[next++];
			results.set(
				gatewayId,
				await runSource(() => fetchGatewayEndpoints(gatewayId)),
			);
		}
	}
	await Promise.all(
		Array.from(
			{ length: Math.min(ENDPOINT_CONCURRENCY, gatewayIds.length) },
			worker,
		),
	);
	return results;
}
