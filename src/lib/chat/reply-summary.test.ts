import { describe, expect, it } from "vitest";
import { replySummary } from "./reply-summary";

const MODEL = "deepseek/deepseek-v4.1-flash";
const routed = {
	provider: "openrouter",
	model: MODEL,
	gatewayId: MODEL,
	host: "OpenInference",
	cost: 0.00021,
};

describe("replySummary", () => {
	it("shows the route and a rounded cost, the rest in the details", () => {
		expect(replySummary(routed, { model: MODEL, gatewayId: MODEL })).toEqual({
			route: "via OpenRouter → OpenInference",
			cost: "$0.0002",
			details: `${MODEL} · OpenRouter · via OpenInference · $0.00021`,
		});
	});

	it("names the model when it isn't the chat's model now", () => {
		const summary = replySummary(routed, {
			model: "openai/gpt-5.5",
			gatewayId: "openai/gpt-5.5",
		});
		expect(summary).toMatchObject({ model: MODEL, gatewayId: MODEL });
	});

	it("names a direct host alone, and marks estimated costs", () => {
		const summary = replySummary(
			{
				provider: "fireworks",
				model: "accounts/fireworks/models/deepseek-v4p1-flash",
				gatewayId: MODEL,
				cost: 0.0000034,
				costEstimated: true,
			},
			{ model: MODEL, gatewayId: MODEL },
		);
		expect(summary).toEqual({
			route: "via Fireworks",
			cost: "<$0.0001",
			details:
				"accounts/fireworks/models/deepseek-v4p1-flash · Fireworks · ~$0.0000034 (estimated from list prices)",
		});
	});

	it("compares by model id without a catalog id, and skips old replies", () => {
		expect(
			replySummary(
				{ provider: "local", model: "qwen3-8b" },
				{ model: "qwen3-8b" },
			),
		).toEqual({ route: "via Local", details: "qwen3-8b · Local" });
		expect(replySummary(undefined, undefined)).toBeNull();
		expect(replySummary({ provider: "openrouter" }, undefined)).toBeNull();
	});
});
