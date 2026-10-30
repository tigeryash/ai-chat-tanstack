import { describe, expect, it } from "vitest";
import { mergeProviderOptions, toCallParams } from "./mapping";
import { PARAM_IDS, REASONING_EFFORTS } from "./registry";
import type { ParamValues } from "./settings";
import type { ParamSupport } from "./support";

const ALL: ParamSupport = {
	params: [...PARAM_IDS],
	reasoningEfforts: [...REASONING_EFFORTS],
	reasoningBudget: { min: 1024, max: 64_000 },
};

const VALUES: ParamValues = {
	temperature: 0.3,
	topK: 20,
	minP: 0.05,
	repetitionPenalty: 1.1,
	maxOutputTokens: 500,
	stopSequences: ["END"],
	seed: 7,
	reasoningEffort: "high",
	verbosity: "low",
};

describe("toCallParams", () => {
	it("sends OpenRouter's extras in its provider options", () => {
		const { settings, providerOptions } = toCallParams(
			{ provider: "openrouter" },
			VALUES,
			ALL,
		);
		expect(settings).toEqual({
			temperature: 0.3,
			maxOutputTokens: 500,
			stopSequences: ["END"],
			seed: 7,
		});
		expect(providerOptions).toEqual({
			openrouter: {
				top_k: 20,
				min_p: 0.05,
				repetition_penalty: 1.1,
				reasoning: { effort: "high" },
				verbosity: "low",
			},
		});
	});

	it("names the repeat penalty the local server's way", () => {
		const { providerOptions } = toCallParams(
			{ provider: "local", endpointKind: "lmstudio" },
			{ repetitionPenalty: 1.2, topK: 30 },
			ALL,
		);
		expect(providerOptions).toEqual({
			local: { top_k: 30, repeat_penalty: 1.2 },
		});
	});

	it("uses AI SDK's own settings on direct providers", () => {
		const { settings, providerOptions } = toCallParams(
			{ provider: "anthropic" },
			{ temperature: 0.5, topK: 10, reasoningEffort: "max" },
			ALL,
		);
		expect(settings).toEqual({ temperature: 0.5, topK: 10, reasoning: "max" });
		expect(providerOptions).toBeUndefined();
	});

	it("turns a thinking budget into each maker's options, dropping the effort", () => {
		const values: ParamValues = {
			reasoningBudget: 4096,
			reasoningEffort: "low",
		};
		expect(toCallParams({ provider: "anthropic" }, values, ALL)).toEqual({
			settings: {},
			providerOptions: {
				anthropic: { thinking: { type: "enabled", budgetTokens: 4096 } },
			},
		});
		expect(
			toCallParams({ provider: "vercel", developer: "google" }, values, ALL)
				.providerOptions,
		).toEqual({ google: { thinkingConfig: { thinkingBudget: 4096 } } });
		expect(
			toCallParams({ provider: "openrouter" }, values, ALL).providerOptions,
		).toEqual({ openrouter: { reasoning: { max_tokens: 4096 } } });
	});

	it("sends OpenAI's verbosity as textVerbosity", () => {
		expect(
			toCallParams({ provider: "openai" }, { verbosity: "high" }, ALL)
				.providerOptions,
		).toEqual({ openai: { textVerbosity: "high" } });
	});

	it("strips what the model doesn't support", () => {
		const support: ParamSupport = {
			params: ["maxOutputTokens", "reasoningEffort", "reasoningBudget"],
			reasoningEfforts: ["low", "medium"],
			reasoningBudget: { min: 2048, max: 8192 },
		};
		const { settings, providerOptions } = toCallParams(
			{ provider: "openrouter" },
			{ ...VALUES, reasoningEffort: "max", reasoningBudget: 100_000 },
			support,
		);
		// temperature, top_k, … aren't supported; "max" isn't offered; the budget is out of range.
		expect(settings).toEqual({ maxOutputTokens: 500 });
		expect(providerOptions).toBeUndefined();
	});

	it("sends nothing without support", () => {
		expect(
			toCallParams({ provider: "openai" }, VALUES, {
				params: [],
				reasoningEfforts: [],
			}),
		).toEqual({ settings: {}, providerOptions: undefined });
	});
});

describe("mergeProviderOptions", () => {
	it("merges per provider", () => {
		expect(
			mergeProviderOptions(
				{ openrouter: { usage: { include: true } } },
				undefined,
				{ openrouter: { top_k: 3 }, openai: { textVerbosity: "low" } },
			),
		).toEqual({
			openrouter: { usage: { include: true }, top_k: 3 },
			openai: { textVerbosity: "low" },
		});
		expect(mergeProviderOptions(undefined)).toBeUndefined();
	});
});
