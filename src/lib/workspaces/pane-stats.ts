import type { UIMessage } from "ai";
import { type ChatUsage, chatUsage } from "@/lib/chat/chat-usage";
import { readReplyStats } from "@/lib/chat/reply-stats";

// A pane's numbers for comparing models side by side (roadmap 3.4): the latest reply's TTFT and
// tokens/sec (what a synced send just compared), their averages over the chat, and the chat's cost
// from `chatUsage` (2.5). Built on the saved reply stats, never re-timed here.

export interface PaneStats {
	/** The latest reply that recorded a TTFT or a speed. */
	last: { ttftMs?: number; tokensPerSecond?: number };
	/** Means over the replies that recorded each. */
	avgTtftMs?: number;
	avgTokensPerSecond?: number;
	/** Replies with any timing. */
	timedReplies: number;
	/** The chat's totals (cost and tokens), or null before a reply recorded either. */
	usage: ChatUsage | null;
}

const mean = (values: readonly number[]) =>
	values.length > 0
		? values.reduce((sum, value) => sum + value, 0) / values.length
		: undefined;

/** Null until a reply has recorded a timing, tokens or a cost. */
export function paneStats(messages: readonly UIMessage[]): PaneStats | null {
	const timed = messages
		.filter((message) => message.role === "assistant")
		.map((message) => readReplyStats(message.metadata))
		.filter(
			(stats) =>
				stats !== null &&
				(stats.ttftMs !== undefined || stats.tokensPerSecond !== undefined),
		)
		.map((stats) => stats ?? {});
	const usage = chatUsage(messages);
	if (timed.length === 0 && !usage) return null;
	const latest = timed.at(-1);
	const ttfts = timed.flatMap((s) =>
		s.ttftMs === undefined ? [] : [s.ttftMs],
	);
	const speeds = timed.flatMap((s) =>
		s.tokensPerSecond === undefined ? [] : [s.tokensPerSecond],
	);
	const avgTtftMs = mean(ttfts);
	const avgTokensPerSecond = mean(speeds);
	return {
		last: {
			...(latest?.ttftMs !== undefined && { ttftMs: latest.ttftMs }),
			...(latest?.tokensPerSecond !== undefined && {
				tokensPerSecond: latest.tokensPerSecond,
			}),
		},
		...(avgTtftMs !== undefined && { avgTtftMs }),
		...(avgTokensPerSecond !== undefined && { avgTokensPerSecond }),
		timedReplies: timed.length,
		usage,
	};
}

/** Same stats, for `useChatMessagesValue` (a fresh object every call otherwise). */
export function samePaneStats(a: PaneStats | null, b: PaneStats | null) {
	return JSON.stringify(a) === JSON.stringify(b);
}
