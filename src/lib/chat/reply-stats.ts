import type { LanguageModelUsage, TextStreamPart, ToolSet } from "ai";
import { formatLatency, formatSpeed } from "@/lib/models/format";

// Tokens and speed for each reply (roadmap 2.5). The transport times the stream in the page: TTFT runs
// from the request to the first reasoning or text token, tokens/sec over the output tokens from that
// first token to the end. Both are saved on the reply's metadata with its token usage.

/** Token counts the provider reported for a reply. */
export interface ReplyUsage {
	inputTokens?: number;
	outputTokens?: number;
	/** Part of `outputTokens`. */
	reasoningTokens?: number;
	/** Part of `inputTokens`, read from the provider's prompt cache. */
	cachedInputTokens?: number;
}

/** What a reply records about its tokens and speed. */
export interface ReplyStats {
	usage?: ReplyUsage;
	/** Milliseconds from sending the request to the first token. */
	ttftMs?: number;
	/** Output tokens per second after the first token. */
	tokensPerSecond?: number;
}

/** Below this, a reply streamed too fast to time (one chunk) and tokens/sec would be noise. */
export const MIN_SPEED_WINDOW_MS = 50;

const count = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) && value >= 0
		? Math.round(value)
		: undefined;

const nonNegative = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) && value >= 0
		? value
		: undefined;

/** Drops absent counts, so old and new replies store the same shape. */
function compact(usage: ReplyUsage): ReplyUsage | undefined {
	const entries = Object.entries(usage).filter(([, v]) => v !== undefined);
	return entries.length > 0
		? (Object.fromEntries(entries) as ReplyUsage)
		: undefined;
}

/** The counts worth keeping from the AI SDK's usage. */
export function usageOf(
	usage: LanguageModelUsage | undefined,
): ReplyUsage | undefined {
	if (!usage) return undefined;
	return compact({
		inputTokens: count(usage.inputTokens),
		outputTokens: count(usage.outputTokens),
		reasoningTokens: count(usage.outputTokenDetails?.reasoningTokens),
		cachedInputTokens: count(usage.inputTokenDetails?.cacheReadTokens),
	});
}

/** Output tokens per second between the first token and the end; undefined when unmeasurable. */
export function tokensPerSecond(
	outputTokens: number | undefined,
	streamMs: number,
): number | undefined {
	if (!outputTokens || streamMs < MIN_SPEED_WINDOW_MS) return undefined;
	return outputTokens / (streamMs / 1000);
}

type StreamPart = TextStreamPart<ToolSet>;

/**
 * Times one reply. Feed it every stream part; on `finish` it returns the stats to save. `now` is
 * injectable for tests.
 */
export function createReplyClock(now: () => number = () => performance.now()) {
	const startedAt = now();
	let firstTokenAt: number | undefined;
	return (part: StreamPart): ReplyStats | undefined => {
		if (
			firstTokenAt === undefined &&
			(part.type === "text-delta" || part.type === "reasoning-delta")
		) {
			firstTokenAt = now();
			return undefined;
		}
		// A stopped reply has no usage, but its TTFT still counts.
		if (part.type === "abort") {
			return firstTokenAt === undefined
				? undefined
				: { ttftMs: Math.round(firstTokenAt - startedAt) };
		}
		if (part.type !== "finish") return undefined;
		const usage = usageOf(part.totalUsage);
		const endedAt = now();
		const speed =
			firstTokenAt === undefined
				? undefined
				: tokensPerSecond(usage?.outputTokens, endedAt - firstTokenAt);
		return {
			...(usage ? { usage } : {}),
			...(firstTokenAt !== undefined
				? { ttftMs: Math.round(firstTokenAt - startedAt) }
				: {}),
			...(speed !== undefined ? { tokensPerSecond: speed } : {}),
		};
	};
}

/** Reads the stats back from saved metadata (stored and imported chats are untrusted). */
export function readReplyStats(metadata: unknown): ReplyStats | null {
	if (typeof metadata !== "object" || metadata === null) return null;
	const raw = metadata as Record<string, unknown>;
	const rawUsage =
		typeof raw.usage === "object" && raw.usage !== null
			? (raw.usage as Record<string, unknown>)
			: {};
	const usage = compact({
		inputTokens: count(rawUsage.inputTokens),
		outputTokens: count(rawUsage.outputTokens),
		reasoningTokens: count(rawUsage.reasoningTokens),
		cachedInputTokens: count(rawUsage.cachedInputTokens),
	});
	const ttftMs = nonNegative(raw.ttftMs);
	const speed = nonNegative(raw.tokensPerSecond);
	if (!usage && ttftMs === undefined && speed === undefined) return null;
	return {
		...(usage ? { usage } : {}),
		...(ttftMs !== undefined ? { ttftMs } : {}),
		...(speed !== undefined ? { tokensPerSecond: speed } : {}),
	};
}

const COMPACT = new Intl.NumberFormat("en", {
	notation: "compact",
	maximumFractionDigits: 1,
});
const FULL = new Intl.NumberFormat("en");

/** 845 → "845", 1_234 → "1.2K", 2_500_000 → "2.5M". */
export function formatTokenCount(tokens: number): string {
	return COMPACT.format(tokens);
}

/** Input plus output, or whichever was reported. */
export function totalTokens(usage: ReplyUsage | undefined): number | undefined {
	if (!usage) return undefined;
	const { inputTokens, outputTokens } = usage;
	if (inputTokens === undefined && outputTokens === undefined) return undefined;
	return (inputTokens ?? 0) + (outputTokens ?? 0);
}

export interface ReplyStatsSummary {
	/** "1.2K tokens", for the line under a reply. */
	tokens?: string;
	/** "TTFT 420 ms". */
	ttft?: string;
	/** "52 tok/s". */
	speed?: string;
	/** Every number, for the tooltip. */
	details: string;
}

/** Null for replies saved before 2.5, or without anything reported. */
export function replyStatsSummary(metadata: unknown): ReplyStatsSummary | null {
	const stats = readReplyStats(metadata);
	if (!stats) return null;
	const { usage } = stats;
	const total = totalTokens(usage);
	const ttft = formatLatency(stats.ttftMs);
	const speed = formatSpeed(stats.tokensPerSecond);
	const split = usage && [
		usage.inputTokens !== undefined &&
			`${FULL.format(usage.inputTokens)} input${
				usage.cachedInputTokens
					? ` (${FULL.format(usage.cachedInputTokens)} cached)`
					: ""
			}`,
		usage.outputTokens !== undefined &&
			`${FULL.format(usage.outputTokens)} output${
				usage.reasoningTokens
					? ` (${FULL.format(usage.reasoningTokens)} reasoning)`
					: ""
			}`,
	];
	return {
		...(total !== undefined
			? { tokens: `${formatTokenCount(total)} tokens` }
			: {}),
		...(ttft ? { ttft: `TTFT ${ttft}` } : {}),
		...(speed ? { speed } : {}),
		details: [
			split && `${split.filter(Boolean).join(" + ")} tokens`,
			ttft && `${ttft} to first token`,
			speed && `${speed} after it`,
		]
			.filter(Boolean)
			.join(" · "),
	};
}
