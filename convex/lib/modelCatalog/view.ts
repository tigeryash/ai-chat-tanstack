import type { ModelRow, NativeId } from "./validators";

// What the app's picker and model card get of a `models` row (roadmap 2.2): only the fields they show
// or route by. The full row is ~1.5 KB a model, mostly supported-parameter lists and per-provider
// pricing that only the parameter registry (2.4b) will need.

export type CatalogModel = {
	gatewayId: string;
	name: string;
	developer: string;
	description: string;
	contextWindow?: number;
	maxOutputTokens?: number;
	/** USD per million tokens. */
	pricing?: { input?: number; output?: number; variesByProvider?: boolean };
	releasedAt?: number;
	knowledgeCutoff?: string;
	inputModalities: string[];
	outputModalities: string[];
	tags: string[];
	zdr: ModelRow["zdr"];
	noTraining: ModelRow["noTraining"];
	/** Gateway providers that serve it, when the sync fetched its endpoints. */
	providers?: string[];
	/** Artificial Analysis Intelligence Index. Showing it requires crediting artificialanalysis.ai. */
	intelligenceIndex?: number;
	nativeIds: NativeId[];
	openRouterId?: string;
	pinned: boolean;
	/** In the High Elo view (decision 14). */
	highElo: boolean;
	status: ModelRow["status"];
	firstSeenAt: number;
	removedAt?: number;
};

export function toCatalogModel(row: ModelRow, highElo: boolean): CatalogModel {
	return {
		gatewayId: row.gatewayId,
		name: row.name,
		developer: row.developer,
		description: row.description,
		contextWindow: row.contextWindow,
		maxOutputTokens: row.maxOutputTokens,
		pricing: row.pricing && {
			input: row.pricing.input,
			output: row.pricing.output,
			variesByProvider: row.pricing.variesByProvider,
		},
		releasedAt: row.releasedAt,
		knowledgeCutoff: row.knowledgeCutoff,
		inputModalities: row.inputModalities,
		outputModalities: row.outputModalities,
		tags: row.tags,
		zdr: row.zdr,
		noTraining: row.noTraining,
		providers: row.providers?.map((provider) => provider.provider),
		intelligenceIndex: row.artificialAnalysis?.intelligenceIndex,
		nativeIds: row.nativeIds,
		openRouterId: row.openRouter?.id,
		pinned: row.pinned,
		highElo,
		status: row.status,
		firstSeenAt: row.firstSeenAt,
		removedAt: row.removedAt,
	};
}
