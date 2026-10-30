import { describe, expect, it } from "vitest";
import type { ParameterProbeResults } from "@/models/parameter-probe";
import { PARAM_IDS, PARAMS } from "./registry";
import { paramSupport } from "./support";

const PROBE: ParameterProbeResults = {
	"maker/probed": {
		openrouter: {
			modelId: "maker/probed",
			probedAt: "2026-10-29",
			parameters: {
				temperature: "rejected",
				top_p: "ignored",
				top_k: "inconclusive",
				max_tokens: "accepted",
				reasoning: "accepted",
				seed: "accepted",
			},
		},
	},
};

const CATALOG = {
	supportedParameters: ["temperature", "top_p", "max_tokens", "reasoning"],
	openRouterParameters: ["temperature", "min_p", "reasoning", "verbosity"],
	reasoningOptions: [
		{ type: "effort", values: ["low", "high", "turbo"] },
		{ type: "toggle" },
	],
};

describe("registry", () => {
	it("defines every id once, with sane ranges", () => {
		for (const id of PARAM_IDS) {
			const param = PARAMS[id];
			expect(param.id).toBe(id);
			if (param.control === "slider" || param.control === "number") {
				expect(param.min).toBeLessThan(param.max);
				expect(param.default).toBeGreaterThanOrEqual(param.min);
				expect(param.default).toBeLessThanOrEqual(param.max);
			}
		}
	});
});

describe("paramSupport", () => {
	it("prefers the probe, showing only accepted settings, over the catalog", () => {
		const support = paramSupport({
			provider: "openrouter",
			gatewayId: "maker/probed",
			catalog: CATALOG,
			probe: PROBE,
		});
		// temperature is in the catalog but the probe rejected it; top_p was ignored.
		expect(support.params).toEqual([
			"maxOutputTokens",
			"seed",
			"reasoningEffort",
		]);
	});

	it("falls back to OpenRouter's own list on OpenRouter, and the Gateway's elsewhere", () => {
		const openRouter = paramSupport({
			provider: "openrouter",
			gatewayId: "maker/unprobed",
			catalog: CATALOG,
			probe: PROBE,
		});
		expect(openRouter.params).toEqual([
			"temperature",
			"minP",
			"reasoningEffort",
			"verbosity",
		]);
		const gateway = paramSupport({
			provider: "vercel",
			developer: "maker",
			gatewayId: "maker/unprobed",
			catalog: CATALOG,
			probe: PROBE,
		});
		expect(gateway.params).toEqual([
			"temperature",
			"topP",
			"maxOutputTokens",
			"reasoningEffort",
		]);
	});

	it("offers only the reasoning efforts the model lists, plus none when it can turn thinking off", () => {
		const support = paramSupport({
			provider: "vercel",
			gatewayId: "maker/unprobed",
			catalog: CATALOG,
			probe: PROBE,
		});
		expect(support.reasoningEfforts).toEqual(["none", "low", "high"]);
	});

	it("hides reasoning effort when the catalog lists no efforts", () => {
		const support = paramSupport({
			provider: "openrouter",
			gatewayId: "maker/probed",
			catalog: { ...CATALOG, reasoningOptions: [] },
			probe: PROBE,
		});
		expect(support.params).not.toContain("reasoningEffort");
		expect(support.reasoningEfforts).toEqual([]);
	});

	it("shows a thinking budget only where the route can send one", () => {
		const catalog = {
			supportedParameters: ["reasoning"],
			reasoningOptions: [{ type: "budget_tokens", min: 2048 }],
		};
		const anthropic = paramSupport({
			provider: "anthropic",
			gatewayId: "anthropic/x",
			catalog,
			probe: {},
		});
		expect(anthropic.params).toEqual(["reasoningBudget"]);
		expect(anthropic.reasoningBudget).toEqual({ min: 2048, max: 128_000 });
		const deepseek = paramSupport({
			provider: "deepseek",
			gatewayId: "anthropic/x",
			catalog,
			probe: {},
		});
		expect(deepseek.params).toEqual([]);
	});

	it("hides everything when nothing is known", () => {
		expect(
			paramSupport({ provider: "openai", gatewayId: undefined, probe: {} })
				.params,
		).toEqual([]);
		expect(
			paramSupport({
				provider: "openrouter",
				gatewayId: "maker/unprobed",
				catalog: undefined,
				probe: PROBE,
			}).params,
		).toEqual([]);
	});

	it("never offers what the route can't send", () => {
		const support = paramSupport({
			provider: "anthropic",
			gatewayId: "maker/unprobed",
			catalog: {
				supportedParameters: ["seed", "presence_penalty", "temperature"],
				reasoningOptions: [],
			},
			probe: {},
		});
		expect(support.params).toEqual(["temperature"]);
	});

	it("gives local servers their own sampling settings", () => {
		expect(
			paramSupport({ provider: "local", endpointKind: "lmstudio" }).params,
		).toContain("repetitionPenalty");
		expect(
			paramSupport({ provider: "local", endpointKind: "custom" }).params,
		).toEqual(expect.arrayContaining(["topK", "minP"]));
		expect(
			paramSupport({ provider: "local", endpointKind: "ollama" }).params,
		).not.toContain("topK");
	});

	it("reads the real probe file for a probed model", () => {
		// Opus 5.5 refused temperature on OpenRouter in the 2.4a run.
		const opus = paramSupport({
			provider: "openrouter",
			gatewayId: "anthropic/claude-opus-5.5",
			catalog: null,
		});
		expect(opus.params).not.toContain("temperature");
		expect(opus.params).toContain("maxOutputTokens");
	});
});
