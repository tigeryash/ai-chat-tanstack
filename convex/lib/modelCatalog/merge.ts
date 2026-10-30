import type { ModelCuration } from "../../../src/models/curation";
import {
	type AaIndex,
	applyNativeIdOverrides,
	indexArtificialAnalysis,
	indexNativeIds,
	indexOpenRouter,
	matchArtificialAnalysis,
	matchNativeIds,
	matchOpenRouter,
	type NativeIdIndex,
	type OpenRouterIndex,
} from "./match";
import { compact, stripServingVariant } from "./normalize";
import type { AaModel } from "./sources/artificialAnalysis";
import type { GatewayFields } from "./sources/gateway";
import type { SourceResult } from "./sources/http";
import type { NativeModelIds } from "./sources/modelsDev";
import type { OpenRouterModel } from "./sources/openRouter";
import type {
	ArtificialAnalysisScores,
	GatewayProvider,
	ModelRow,
} from "./validators";

// Builds the next catalog from the previous one plus whatever each source returned this run.
// The rule throughout: a source that failed contributes nothing and erases nothing. Its fields keep
// their previous values, and only a Gateway list that loaded can mark a model `removed`.

export type CatalogSources = {
	gateway: SourceResult<GatewayFields[]>;
	artificialAnalysis: SourceResult<AaModel[]>;
	modelsDev: SourceResult<NativeModelIds>;
	openRouter: SourceResult<OpenRouterModel[]>;
};

export type Curation = {
	models: Readonly<Record<string, ModelCuration>>;
	hiddenPatterns: readonly RegExp[];
};

/** Below this share of the current active models, a Gateway answer is treated as broken, not as removals. */
const MIN_GATEWAY_SHARE = 0.5;

/** Turns an empty or suspiciously short Gateway list into a failure, so it can't mark most models removed. */
export function guardGatewayResult(
	result: SourceResult<GatewayFields[]>,
	previous: readonly ModelRow[],
): SourceResult<GatewayFields[]> {
	if (!result.ok) return result;
	const activeBefore = previous.filter((row) => row.status === "active").length;
	const count = result.data.length;
	if (count === 0)
		return { ok: false, error: "Gateway listed no language models" };
	if (count < activeBefore * MIN_GATEWAY_SHARE) {
		return {
			ok: false,
			error: `Gateway listed ${count} language models, under half of the ${activeBefore} active now`,
		};
	}
	return result;
}

type Indexes = {
	artificialAnalysis?: AaIndex;
	nativeIds?: NativeIdIndex;
	openRouter?: OpenRouterIndex;
};

export function buildCatalog(
	previous: readonly ModelRow[],
	sources: CatalogSources,
	curation: Curation,
	now: number,
): ModelRow[] {
	const previousById = new Map(previous.map((row) => [row.gatewayId, row]));
	const indexes: Indexes = {
		artificialAnalysis: sources.artificialAnalysis.ok
			? indexArtificialAnalysis(sources.artificialAnalysis.data)
			: undefined,
		nativeIds: sources.modelsDev.ok
			? indexNativeIds(sources.modelsDev.data)
			: undefined,
		openRouter: sources.openRouter.ok
			? indexOpenRouter(sources.openRouter.data)
			: undefined,
	};

	if (!sources.gateway.ok) {
		return previous.map((row) =>
			row.status === "active" ? enrich(row, row, indexes, curation) : row,
		);
	}

	const listed = new Set<string>();
	const next: ModelRow[] = [];
	for (const fields of sources.gateway.data) {
		if (listed.has(fields.gatewayId)) continue;
		listed.add(fields.gatewayId);
		const before = previousById.get(fields.gatewayId);
		const base: ModelRow = {
			...fields,
			nativeIds: [],
			pinned: false,
			hidden: false,
			status: "active",
			firstSeenAt: before?.firstSeenAt ?? now,
		};
		next.push(enrich(base, before, indexes, curation));
	}
	// Gone from the Gateway: kept as they were, marked removed (decision 14).
	for (const row of previous) {
		if (listed.has(row.gatewayId)) continue;
		next.push(
			row.status === "removed"
				? row
				: { ...row, status: "removed", removedAt: now },
		);
	}
	return next;
}

/** Adds the other sources and curation to an active row's Gateway fields. */
function enrich(
	base: ModelRow,
	before: ModelRow | undefined,
	indexes: Indexes,
	curation: Curation,
): ModelRow {
	const curated = curation.models[base.gatewayId] ?? {};
	const artificialAnalysis = indexes.artificialAnalysis
		? toScores(
				matchArtificialAnalysis(base.gatewayId, indexes.artificialAnalysis, {
					curated: curated.artificialAnalysisSlug,
					previousModelId: before?.artificialAnalysis?.modelId,
				}),
			)
		: before?.artificialAnalysis;
	const openRouter = indexes.openRouter
		? matchOpenRouter(base.gatewayId, indexes.openRouter, curated.openRouterId)
		: before?.openRouter;
	const nativeIds = indexes.nativeIds
		? matchNativeIds(base.gatewayId, indexes.nativeIds)
		: (before?.nativeIds ?? []);

	return compact({
		...base,
		name: curated.displayName ?? base.name,
		description: curated.description ?? base.description,
		supportedParameters: applyParameterOverrides(
			base.supportedParameters,
			curated.parameters,
		),
		providers: before?.providers,
		providersSyncedAt: before?.providersSyncedAt,
		artificialAnalysis,
		nativeIds: applyNativeIdOverrides(nativeIds, curated.nativeIds),
		openRouter: openRouter
			? {
					id: openRouter.id,
					supportedParameters: [...openRouter.supportedParameters],
				}
			: undefined,
		pinned: curated.pinned === true,
		hidden:
			curated.hidden === true ||
			curation.hiddenPatterns.some((pattern) => pattern.test(base.gatewayId)),
		status: "active" as const,
		removedAt: undefined,
	});
}

function toScores(
	model: AaModel | undefined,
): ArtificialAnalysisScores | undefined {
	if (!model) return undefined;
	return compact({
		modelId: model.id,
		slug: model.slug,
		creatorId: model.creatorId,
		intelligenceIndex: model.intelligenceIndex,
		codingIndex: model.codingIndex,
		mathIndex: model.mathIndex,
		outputTokensPerSecond: model.outputTokensPerSecond,
		timeToFirstTokenSeconds: model.timeToFirstTokenSeconds,
	});
}

function applyParameterOverrides(
	parameters: readonly string[],
	overrides: ModelCuration["parameters"],
): string[] {
	if (!overrides) return [...parameters];
	const removed = new Set(overrides.remove ?? []);
	const result = parameters.filter((parameter) => !removed.has(parameter));
	for (const parameter of overrides.add ?? []) {
		if (!result.includes(parameter)) result.push(parameter);
	}
	return result;
}

/**
 * Which models get the per-model endpoints call this run: every pin, plus the top `limit` others by
 * Intelligence Index (newest first where there's no score). Serving variants share their base
 * model's score, so each scored model takes one slot, given to the base id. Keeps the sync to a few
 * dozen requests.
 */
export function selectEndpointTargets(
	rows: readonly ModelRow[],
	limit: number,
): string[] {
	const candidates = rows.filter(
		(row) => row.status === "active" && !row.hidden,
	);
	const pinned = candidates
		.filter((row) => row.pinned)
		.map((row) => row.gatewayId);
	const isVariant = (row: ModelRow) =>
		stripServingVariant(row.gatewayId) !== row.gatewayId;
	const ranked = candidates
		.filter((row) => !row.pinned)
		.sort(
			(a, b) =>
				(b.artificialAnalysis?.intelligenceIndex ?? -1) -
					(a.artificialAnalysis?.intelligenceIndex ?? -1) ||
				Number(isVariant(a)) - Number(isVariant(b)) ||
				(b.releasedAt ?? 0) - (a.releasedAt ?? 0) ||
				a.gatewayId.localeCompare(b.gatewayId),
		);
	const scoredModels = new Set(
		candidates
			.filter((row) => row.pinned)
			.flatMap((row) => row.artificialAnalysis?.modelId ?? []),
	);
	const chosen: string[] = [];
	for (const row of ranked) {
		if (chosen.length >= limit) break;
		const scoredModel = row.artificialAnalysis?.modelId;
		if (scoredModel && scoredModels.has(scoredModel)) continue;
		if (scoredModel) scoredModels.add(scoredModel);
		chosen.push(row.gatewayId);
	}
	return [...pinned, ...chosen];
}

/** Stores each model's providers that loaded; a model whose call failed keeps its old list. */
export function applyEndpoints(
	rows: readonly ModelRow[],
	results: ReadonlyMap<string, SourceResult<GatewayProvider[]>>,
	now: number,
): ModelRow[] {
	return rows.map((row) => {
		const result = results.get(row.gatewayId);
		if (!result?.ok) return row;
		return { ...row, providers: result.data, providersSyncedAt: now };
	});
}
