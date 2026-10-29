import { describe, expect, it } from "vitest";
import {
	blendedPrice,
	DEFAULT_FILTERS,
	developersOf,
	filterModels,
	type PickerFilters,
} from "./picker-filter";
import { TEST_MODELS } from "./test-catalog";

const names = (filters: Partial<PickerFilters>) =>
	filterModels(TEST_MODELS, { ...DEFAULT_FILTERS, ...filters }).map(
		(model) => model.name,
	);

describe("filterModels", () => {
	it("opens on the High Elo view, best Intelligence Index first", () => {
		expect(names({})).toEqual([
			"Claude Opus 5.5",
			"GPT-5.5",
			"Grok 4.7",
			"Gemini 3.8 Flash",
		]);
	});

	it("lists no catalog model under Local", () => {
		expect(names({ view: "local" })).toEqual([]);
		expect(names({ view: "local", search: "claude" })).toEqual([]);
	});

	it("lists every model under All, unscored ones last", () => {
		const all = names({ view: "all" });
		expect(all).toHaveLength(TEST_MODELS.length);
		expect(all.at(-1)).toBe("DeepSeek V4.1 Flash");
	});

	it("searches names, ids and developers", () => {
		expect(names({ view: "all", search: "claude" })).toEqual([
			"Claude Opus 5.5",
			"Claude Sonnet 5",
		]);
		expect(names({ view: "all", search: "moonshotai k3" })).toEqual([
			"Kimi K3",
		]);
	});

	it("filters by developer, price, context and capabilities", () => {
		expect(names({ view: "all", developer: "anthropic" })).toEqual([
			"Claude Opus 5.5",
			"Claude Sonnet 5",
		]);
		// Kimi K3 blends to $1.075.
		expect(names({ view: "all", maxPrice: 1 })).toEqual([
			"Gemini 3.8 Flash",
			"DeepSeek V4.1 Flash",
		]);
		expect(names({ minContext: 1_000_000 })).toEqual([
			"Claude Opus 5.5",
			"Gemini 3.8 Flash",
		]);
		expect(
			names({ view: "all", capabilities: ["vision", "web-search"] }),
		).toEqual(["GPT-5.5"]);
	});

	it("sorts by price and by release date", () => {
		expect(names({ view: "all", sort: "price" }).slice(0, 2)).toEqual([
			"DeepSeek V4.1 Flash",
			"Gemini 3.8 Flash",
		]);
		expect(names({ sort: "newest" })).toEqual([
			"GPT-5.5",
			"Claude Opus 5.5",
			"Grok 4.7",
			"Gemini 3.8 Flash",
		]);
	});
});

describe("blendedPrice", () => {
	it("weighs input 3 to 1 against output", () => {
		expect(blendedPrice({ pricing: { input: 1, output: 5 } })).toBe(2);
		expect(blendedPrice({ pricing: { input: 1 } })).toBeUndefined();
	});
});

describe("developersOf", () => {
	it("lists each developer once", () => {
		expect(developersOf(TEST_MODELS)).toEqual([
			"anthropic",
			"deepseek",
			"google",
			"moonshotai",
			"openai",
			"spacexai",
		]);
	});
});
