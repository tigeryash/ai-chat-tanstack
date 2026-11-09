import type { LanguageModelUsage, TextStreamPart, ToolSet } from "ai";
import { describe, expect, it } from "vitest";
import {
	createReplyClock,
	formatTokenCount,
	MIN_SPEED_WINDOW_MS,
	readReplyStats,
	replyStatsSummary,
	tokensPerSecond,
	usageOf,
} from "./reply-stats";

type Part = TextStreamPart<ToolSet>;

const usage = (
	input: number | undefined,
	output: number | undefined,
	extra: { cached?: number; reasoning?: number } = {},
): LanguageModelUsage => ({
	inputTokens: input,
	inputTokenDetails: {
		noCacheTokens: undefined,
		cacheReadTokens: extra.cached,
		cacheWriteTokens: undefined,
	},
	outputTokens: output,
	outputTokenDetails: {
		textTokens: undefined,
		reasoningTokens: extra.reasoning,
	},
	totalTokens: undefined,
});

const delta = { type: "text-delta", id: "t", text: "x" } as Part;
const finish = (total: LanguageModelUsage) =>
	({ type: "finish", totalUsage: total }) as unknown as Part;

function clockAt(times: number[]) {
	const queue = [...times];
	return createReplyClock(() => queue.shift() ?? Number.NaN);
}

describe("usageOf", () => {
	it("keeps the counts the provider reported, and nothing when it reported none", () => {
		expect(usageOf(usage(1200, 340, { cached: 1000, reasoning: 90 }))).toEqual({
			inputTokens: 1200,
			outputTokens: 340,
			cachedInputTokens: 1000,
			reasoningTokens: 90,
		});
		expect(usageOf(usage(undefined, 7))).toEqual({ outputTokens: 7 });
		expect(usageOf(usage(undefined, undefined))).toBeUndefined();
		expect(usageOf(undefined)).toBeUndefined();
	});
});

describe("tokensPerSecond", () => {
	it("divides output tokens by the time after the first token", () => {
		expect(tokensPerSecond(500, 10_000)).toBe(50);
	});

	it("gives nothing for a reply too quick or too empty to time", () => {
		expect(tokensPerSecond(500, MIN_SPEED_WINDOW_MS - 1)).toBeUndefined();
		expect(tokensPerSecond(0, 10_000)).toBeUndefined();
		expect(tokensPerSecond(undefined, 10_000)).toBeUndefined();
	});
});

describe("createReplyClock", () => {
	it("times the first token from the request, and the rest from the first token", () => {
		const clock = clockAt([1000, 1420, 11_420]);
		expect(clock({ type: "start" } as Part)).toBeUndefined();
		expect(clock(delta)).toBeUndefined();
		expect(clock(delta)).toBeUndefined();
		expect(clock(finish(usage(12, 520)))).toEqual({
			usage: { inputTokens: 12, outputTokens: 520 },
			ttftMs: 420,
			tokensPerSecond: 52,
		});
	});

	it("counts reasoning as the first token", () => {
		const clock = clockAt([0, 250, 1250]);
		clock({ type: "reasoning-delta", id: "r", text: "hm" } as Part);
		expect(clock(finish(usage(1, 10)))).toMatchObject({ ttftMs: 250 });
	});

	it("records only usage when no token arrived, and only TTFT when stopped", () => {
		expect(clockAt([0, 5])(finish(usage(4, 0)))).toEqual({
			usage: { inputTokens: 4, outputTokens: 0 },
		});
		const stopped = clockAt([0, 300]);
		stopped(delta);
		expect(stopped({ type: "abort" } as Part)).toEqual({ ttftMs: 300 });
	});
});

describe("readReplyStats", () => {
	it("reads saved stats and drops anything malformed", () => {
		expect(
			readReplyStats({
				usage: { inputTokens: 3, outputTokens: "5", reasoningTokens: -1 },
				ttftMs: Number.POSITIVE_INFINITY,
				tokensPerSecond: 40,
			}),
		).toEqual({ usage: { inputTokens: 3 }, tokensPerSecond: 40 });
		expect(readReplyStats({ provider: "openrouter", model: "x" })).toBeNull();
		expect(readReplyStats(undefined)).toBeNull();
	});
});

describe("replyStatsSummary", () => {
	it("shows tokens, TTFT and speed, with the split in the details", () => {
		expect(
			replyStatsSummary({
				usage: {
					inputTokens: 1200,
					outputTokens: 340,
					cachedInputTokens: 1000,
					reasoningTokens: 90,
				},
				ttftMs: 420,
				tokensPerSecond: 52.4,
			}),
		).toEqual({
			tokens: "1.5K tokens",
			ttft: "TTFT 420 ms",
			speed: "52 tok/s",
			details:
				"1,200 input (1,000 cached) + 340 output (90 reasoning) tokens · 420 ms to first token · 52 tok/s after it",
		});
	});

	it("skips replies saved before usage was recorded", () => {
		expect(replyStatsSummary({ provider: "local", model: "m" })).toBeNull();
	});
});

describe("formatTokenCount", () => {
	it("keeps small counts exact and shortens big ones", () => {
		expect(formatTokenCount(845)).toBe("845");
		expect(formatTokenCount(1234)).toBe("1.2K");
		expect(formatTokenCount(2_500_000)).toBe("2.5M");
	});
});
