import {
	NATIVE_ID_PROVIDERS,
	type NativeIdProvider,
} from "../../../src/models/providers";
import {
	lastSegment,
	modelPart,
	normalizeSlug,
	stripServingVariant,
	tokenKey,
	undoFireworksDecimals,
} from "./normalize";
import type { AaModel } from "./sources/artificialAnalysis";
import type { NativeModelIds } from "./sources/modelsDev";
import type { OpenRouterModel } from "./sources/openRouter";
import type { NativeId } from "./validators";

// Joins other catalogs to Gateway ids. Matches are exact on normalized names; anything fuzzier
// goes in src/models/curation.ts instead, so a wrong score never appears silently.

/** Adds a key, or marks it ambiguous (`null`) when a second value claims it. */
function addUnique<T>(index: Map<string, T | null>, key: string, value: T) {
	if (!key) return;
	const existing = index.get(key);
	if (existing === undefined) index.set(key, value);
	else if (existing !== value) index.set(key, null);
}

export type AaIndex = {
	byId: Map<string, AaModel>;
	bySlug: Map<string, AaModel>;
	byTokens: Map<string, AaModel | null>;
};

export function indexArtificialAnalysis(models: readonly AaModel[]): AaIndex {
	const byId = new Map<string, AaModel>();
	const bySlug = new Map<string, AaModel>();
	const byTokens = new Map<string, AaModel | null>();
	for (const model of models) {
		byId.set(model.id, model);
		bySlug.set(normalizeSlug(model.slug), model);
		addUnique(byTokens, tokenKey(model.slug), model);
	}
	return { byId, bySlug, byTokens };
}

/**
 * Curation wins, then the id matched on an earlier run (Artificial Analysis ids are stable, slugs
 * can be renamed), then the Gateway slug: exact, then the same words in another order. Serving
 * variants ("-fast", "-batch") fall back to their base model.
 */
export function matchArtificialAnalysis(
	gatewayId: string,
	index: AaIndex,
	hints: { curated?: string | null; previousModelId?: string },
): AaModel | undefined {
	if (hints.curated === null) return undefined;
	if (hints.curated !== undefined) {
		return (
			index.byId.get(hints.curated) ??
			index.bySlug.get(normalizeSlug(hints.curated))
		);
	}
	if (hints.previousModelId) {
		const previous = index.byId.get(hints.previousModelId);
		if (previous) return previous;
	}
	const slug = normalizeSlug(modelPart(gatewayId));
	for (const candidate of new Set([slug, stripServingVariant(slug)])) {
		const exact = index.bySlug.get(candidate);
		if (exact) return exact;
		const reordered = index.byTokens.get(tokenKey(candidate));
		if (reordered) return reordered;
	}
	return undefined;
}

export type OpenRouterIndex = {
	byId: Map<string, OpenRouterModel>;
	bySlug: Map<string, OpenRouterModel | null>;
};

export function indexOpenRouter(
	models: readonly OpenRouterModel[],
): OpenRouterIndex {
	const byId = new Map<string, OpenRouterModel>();
	const bySlug = new Map<string, OpenRouterModel | null>();
	for (const model of models) {
		byId.set(model.id, model);
		addUnique(bySlug, normalizeSlug(modelPart(model.id)), model);
	}
	return { byId, bySlug };
}

/** Same id, or the same model name under another creator name ("spacexai/" vs "x-ai/") if unique. */
export function matchOpenRouter(
	gatewayId: string,
	index: OpenRouterIndex,
	curated: string | null | undefined,
): OpenRouterModel | undefined {
	if (curated === null) return undefined;
	if (curated !== undefined) return index.byId.get(curated);
	return (
		index.byId.get(gatewayId) ??
		index.bySlug.get(normalizeSlug(modelPart(gatewayId))) ??
		undefined
	);
}

export type NativeIdIndex = Record<NativeIdProvider, Map<string, string>>;

/**
 * Keys for a provider's own id: whole id, last path segment, and Fireworks' "p"-for-dot spelling.
 * On a clash the shorter id wins (an undated alias over a dated snapshot).
 */
export function indexNativeIds(ids: NativeModelIds): NativeIdIndex {
	const index = {} as NativeIdIndex;
	for (const provider of NATIVE_ID_PROVIDERS) {
		const byKey = new Map<string, string>();
		for (const id of ids[provider]) {
			const last = lastSegment(id);
			for (const key of [
				normalizeSlug(id),
				normalizeSlug(last),
				normalizeSlug(undoFireworksDecimals(last)),
			]) {
				const existing = byKey.get(key);
				if (!existing || id.length < existing.length) byKey.set(key, id);
			}
		}
		index[provider] = byKey;
	}
	return index;
}

export function matchNativeIds(
	gatewayId: string,
	index: NativeIdIndex,
): NativeId[] {
	const key = normalizeSlug(modelPart(gatewayId));
	return NATIVE_ID_PROVIDERS.flatMap((provider) => {
		const modelId = index[provider].get(key);
		return modelId ? [{ provider, modelId }] : [];
	});
}

/** Curation sets or (with `null`) removes single providers; the rest stay as matched. */
export function applyNativeIdOverrides(
	matched: readonly NativeId[],
	overrides: Partial<Record<NativeIdProvider, string | null>> | undefined,
): NativeId[] {
	if (!overrides) return [...matched];
	const byProvider = new Map(
		matched.map((entry) => [entry.provider, entry.modelId]),
	);
	for (const [provider, modelId] of Object.entries(overrides)) {
		if (modelId === null) byProvider.delete(provider);
		else if (modelId !== undefined) byProvider.set(provider, modelId);
	}
	const order = (provider: string) =>
		NATIVE_ID_PROVIDERS.indexOf(provider as NativeIdProvider);
	return [...byProvider.entries()]
		.sort(([a], [b]) => order(a) - order(b))
		.map(([provider, modelId]) => ({ provider, modelId }));
}
