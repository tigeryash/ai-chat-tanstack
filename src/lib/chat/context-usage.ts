import type { UIMessage } from "ai";
import { readReplyStats } from "./reply-stats";

// Context-length warnings (roadmap R2 S4, docs/settings-research.md "Host preferences detail"): how
// full the chat's context is on the host or model it runs on. The latest reply's input plus output
// tokens is what the next request sends again (its prompt held the whole history), so that's the
// chat's size. The header's running total sums every reply's input, which counts the history once per
// turn and would warn far too early.

/** From this share of the context on, the chat is nearing it. */
export const CONTEXT_NEARING_RATIO = 0.8;

export type ContextLevel = "under" | "nearing" | "over";

/** The latest reply's input plus output tokens, or null when no reply has recorded them. */
export function contextTokens(messages: readonly UIMessage[]): number | null {
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (message?.role !== "assistant") continue;
		const usage = readReplyStats(message.metadata)?.usage;
		if (usage?.inputTokens === undefined && usage?.outputTokens === undefined)
			continue;
		return (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
	}
	return null;
}

/** Where `tokens` sits against `contextLength`; null when either is unknown. */
export function contextLevel(
	tokens: number | null,
	contextLength: number | undefined,
): ContextLevel | null {
	if (tokens === null || !contextLength || contextLength <= 0) return null;
	if (tokens >= contextLength) return "over";
	return tokens >= contextLength * CONTEXT_NEARING_RATIO ? "nearing" : "under";
}
