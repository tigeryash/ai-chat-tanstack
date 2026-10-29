import { type Capability, capabilitiesOf } from "./capabilities";
import type { CatalogModel } from "./catalog";

// What the model picker shows (roadmap 2.2): the High Elo / All / Local view, search, filters and
// sort. Pure, so the picker component only holds the state.

export const PICKER_VIEWS = ["high-elo", "all", "local"] as const;
/** "local" lists only the saved local servers' models, none from the catalog. */
export type PickerView = (typeof PICKER_VIEWS)[number];
export type PickerSort = "intelligence" | "price" | "newest";

export interface PickerFilters {
	view: PickerView;
	search: string;
	/** Gateway developer id, or "" for every developer. */
	developer: string;
	/** Most a model may cost, blended USD per million tokens. */
	maxPrice?: number;
	minContext?: number;
	capabilities: readonly Capability[];
	sort: PickerSort;
}

export const DEFAULT_FILTERS: PickerFilters = {
	view: "high-elo",
	search: "",
	developer: "",
	capabilities: [],
	sort: "intelligence",
};

/**
 * One price to filter and sort by: 3 parts input to 1 part output, per million tokens (the blend
 * Artificial Analysis uses). Undefined when the catalog has no price.
 */
export function blendedPrice(model: Pick<CatalogModel, "pricing">) {
	const { input, output } = model.pricing ?? {};
	if (input === undefined || output === undefined) return undefined;
	return (3 * input + output) / 4;
}

function matchesSearch(model: CatalogModel, search: string): boolean {
	const words = search.toLowerCase().split(/\s+/).filter(Boolean);
	const haystack =
		`${model.name} ${model.gatewayId} ${model.developer}`.toLowerCase();
	return words.every((word) => haystack.includes(word));
}

function matches(model: CatalogModel, filters: PickerFilters): boolean {
	if (filters.view === "local") return false;
	if (filters.view === "high-elo" && !model.highElo) return false;
	if (filters.developer && model.developer !== filters.developer) return false;
	if (filters.maxPrice !== undefined) {
		const price = blendedPrice(model);
		if (price === undefined || price > filters.maxPrice) return false;
	}
	if (
		filters.minContext !== undefined &&
		(model.contextWindow ?? 0) < filters.minContext
	) {
		return false;
	}
	if (filters.capabilities.length > 0) {
		const has = new Set(capabilitiesOf(model));
		if (!filters.capabilities.every((capability) => has.has(capability))) {
			return false;
		}
	}
	return matchesSearch(model, filters.search);
}

/** Missing values sort last whichever way the key runs. */
function compareMissingLast(
	a: number | undefined,
	b: number | undefined,
	direction: 1 | -1,
): number {
	if (a === undefined && b === undefined) return 0;
	if (a === undefined) return 1;
	if (b === undefined) return -1;
	return (a - b) * direction;
}

const SORTS: Record<PickerSort, (a: CatalogModel, b: CatalogModel) => number> =
	{
		intelligence: (a, b) =>
			compareMissingLast(a.intelligenceIndex, b.intelligenceIndex, -1),
		price: (a, b) => compareMissingLast(blendedPrice(a), blendedPrice(b), 1),
		newest: (a, b) => compareMissingLast(a.releasedAt, b.releasedAt, -1),
	};

export function filterModels(
	models: readonly CatalogModel[],
	filters: PickerFilters,
): CatalogModel[] {
	return models
		.filter((model) => matches(model, filters))
		.sort((a, b) => SORTS[filters.sort](a, b) || a.name.localeCompare(b.name));
}

/** Developers in the catalog, for the filter, by name. */
export function developersOf(models: readonly CatalogModel[]): string[] {
	return [...new Set(models.map((model) => model.developer))].sort();
}
