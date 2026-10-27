import { describe, expect, it } from "vitest";
import { modelFamily, suggestReplacement } from "./family";

describe("modelFamily", () => {
	it.each([
		["anthropic/claude-sonnet-4.5", "claude-sonnet"],
		["anthropic/claude-opus-5.5", "claude-opus"],
		["openai/gpt-5.4-mini", "gpt-mini"],
		["openai/gpt-4o", "gpt"],
		["google/gemini-3.8-flash", "gemini-flash"],
		["deepseek/deepseek-v4.1-flash", "deepseek-flash"],
		["openai/gpt-4.1-2025-04-14", "gpt"],
		["moonshotai/kimi-k2", "kimi-k2"],
	])("%s → %s", (id, family) => {
		expect(modelFamily(id)).toBe(family);
	});
});

describe("suggestReplacement", () => {
	const removed = {
		gatewayId: "anthropic/claude-sonnet-4.5",
		developer: "anthropic",
		releasedAt: 1,
	};

	it("picks the newest model from the same developer and family", () => {
		const active = [
			{
				gatewayId: "anthropic/claude-sonnet-5",
				developer: "anthropic",
				releasedAt: 5,
			},
			{
				gatewayId: "anthropic/claude-sonnet-5.5",
				developer: "anthropic",
				releasedAt: 9,
			},
			{
				gatewayId: "anthropic/claude-opus-6",
				developer: "anthropic",
				releasedAt: 12,
			},
			{
				gatewayId: "other/claude-sonnet-9",
				developer: "other",
				releasedAt: 20,
			},
		];
		expect(suggestReplacement(removed, active)?.gatewayId).toBe(
			"anthropic/claude-sonnet-5.5",
		);
	});

	it("suggests nothing when the family has no active model", () => {
		const active = [
			{ gatewayId: "anthropic/claude-opus-6", developer: "anthropic" },
		];
		expect(suggestReplacement(removed, active)).toBeUndefined();
	});
});
