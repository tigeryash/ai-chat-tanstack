import { describe, expect, it } from "vitest";
import { inlineReplyStats, replyDetails } from "./reply-details";
import { USAGE_FIXTURE_MESSAGES } from "./usage.fixtures";

const replies = USAGE_FIXTURE_MESSAGES.filter((m) => m.role === "assistant");
const rows = (metadata: unknown) =>
	replyDetails(metadata)?.map(({ label, value }) => `${label}: ${value}`);

describe("replyDetails", () => {
	it("lists the model, route, exact cost, token split and timings", () => {
		expect(rows(replies[0]?.metadata)).toEqual([
			"Model: deepseek/deepseek-v4.1-flash",
			"Host: OpenRouter → DeepInfra",
			"Cost: $0.0042",
			"Tokens: 1,540",
			"Input: 1,200",
			"Output: 340 (90 reasoning)",
			"Time to first token: 420 ms",
			"Speed: 52 tok/s",
		]);
	});

	it("marks estimated costs and says when there is no price", () => {
		expect(rows(replies[1]?.metadata)).toContain(
			"Cost: ~$0.0011 (estimated from list prices)",
		);
		const local = rows(replies[2]?.metadata);
		expect(local).toContain("Host: Local");
		expect(local).toContain("Cost: No price");
		expect(local?.some((row) => row.startsWith("Speed"))).toBe(false);
	});

	it("shows cached input tokens", () => {
		expect(
			rows({
				provider: "openai",
				model: "gpt-5.5",
				usage: { inputTokens: 2000, cachedInputTokens: 1500 },
			}),
		).toContain("Input: 2,000 (1,500 cached)");
	});

	it("keeps only the host and cost for replies saved before 2.5", () => {
		expect(rows({ provider: "openai", model: "gpt-5.5", cost: 0.01 })).toEqual([
			"Model: gpt-5.5",
			"Host: OpenAI",
			"Cost: $0.01",
		]);
	});

	it("is null without metadata, and ignores malformed values", () => {
		expect(replyDetails(undefined)).toBeNull();
		expect(replyDetails({ provider: "openai" })).toBeNull();
		expect(replyDetails({ provider: "openai", model: 42 })).toBeNull();
		expect(
			rows({ provider: "openai", model: "m", ttftMs: -5, usage: "lots" }),
		).toEqual(["Model: m", "Host: OpenAI", "Cost: No price"]);
	});
});

describe("inlineReplyStats", () => {
	it("shows nothing by default", () => {
		expect(inlineReplyStats(replies[0]?.metadata, "none")).toEqual([]);
	});

	it("shows only the cost, marking estimates", () => {
		expect(inlineReplyStats(replies[0]?.metadata, "cost")).toEqual(["$0.0042"]);
		expect(inlineReplyStats(replies[1]?.metadata, "cost")).toEqual([
			"~$0.0011",
		]);
	});

	it("shows cost, tokens and timings for all", () => {
		expect(inlineReplyStats(replies[0]?.metadata, "all")).toEqual([
			"$0.0042",
			"1,540 tokens",
			"420 ms",
			"52 tok/s",
		]);
	});

	it("skips what wasn't recorded, and malformed metadata", () => {
		expect(inlineReplyStats(replies[2]?.metadata, "cost")).toEqual([]);
		expect(inlineReplyStats(undefined, "all")).toEqual([]);
		expect(inlineReplyStats({ model: "m", ttftMs: -5 }, "all")).toEqual([]);
	});
});
