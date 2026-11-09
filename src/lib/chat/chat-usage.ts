import type { UIMessage } from "ai";
import {
	CHAT_PROVIDER_IDS,
	type ChatProviderId,
	LOCAL_PROVIDER,
	providerName,
} from "./model-selection";
import { readReplyStats } from "./reply-stats";

// A chat's totals (roadmap 2.5): tokens and cost over every reply, overall and per provider (the one
// that bills you: a reply through OpenRouter counts as OpenRouter, whichever upstream served it).

export interface UsageTotals {
	replies: number;
	inputTokens: number;
	outputTokens: number;
	/** USD over the replies that have a cost. */
	cost: number;
	/** True when any of that cost is estimated from catalog prices. */
	costEstimated: boolean;
	/** Replies with no cost: local models, or a hosted model without catalog prices. */
	unpriced: number;
}

export interface ProviderUsage extends UsageTotals {
	provider: ChatProviderId;
	/** "OpenRouter", "Local". */
	name: string;
}

export interface ChatUsage {
	total: UsageTotals;
	/** Most expensive first, then most tokens. */
	byProvider: ProviderUsage[];
}

const empty = (): UsageTotals => ({
	replies: 0,
	inputTokens: 0,
	outputTokens: 0,
	cost: 0,
	costEstimated: false,
	unpriced: 0,
});

const isProvider = (value: unknown): value is ChatProviderId =>
	typeof value === "string" &&
	(CHAT_PROVIDER_IDS as readonly string[]).includes(value);

const nameOf = (provider: ChatProviderId) =>
	provider === LOCAL_PROVIDER ? "Local" : providerName(provider);

interface ReplyFigures {
	inputTokens: number;
	outputTokens: number;
	cost?: number;
	costEstimated: boolean;
}

function figuresOf(metadata: unknown): ReplyFigures | null {
	const stats = readReplyStats(metadata);
	const raw = metadata as Record<string, unknown>;
	const cost =
		typeof raw.cost === "number" && Number.isFinite(raw.cost) && raw.cost >= 0
			? raw.cost
			: undefined;
	if (!stats?.usage && cost === undefined) return null;
	return {
		inputTokens: stats?.usage?.inputTokens ?? 0,
		outputTokens: stats?.usage?.outputTokens ?? 0,
		cost,
		costEstimated: cost !== undefined && raw.costEstimated === true,
	};
}

function add(totals: UsageTotals, reply: ReplyFigures): UsageTotals {
	return {
		replies: totals.replies + 1,
		inputTokens: totals.inputTokens + reply.inputTokens,
		outputTokens: totals.outputTokens + reply.outputTokens,
		cost: totals.cost + (reply.cost ?? 0),
		costEstimated: totals.costEstimated || reply.costEstimated,
		unpriced: totals.unpriced + (reply.cost === undefined ? 1 : 0),
	};
}

/** Null until a reply has recorded tokens or a cost (replies saved before 2.2b and 2.5 have neither). */
export function chatUsage(messages: readonly UIMessage[]): ChatUsage | null {
	let total = empty();
	const byProvider = new Map<ChatProviderId, UsageTotals>();
	for (const message of messages) {
		if (message.role !== "assistant") continue;
		const metadata = message.metadata as { provider?: unknown } | undefined;
		if (!metadata || !isProvider(metadata.provider)) continue;
		const figures = figuresOf(metadata);
		if (!figures) continue;
		total = add(total, figures);
		byProvider.set(
			metadata.provider,
			add(byProvider.get(metadata.provider) ?? empty(), figures),
		);
	}
	if (total.replies === 0) return null;
	return {
		total,
		byProvider: [...byProvider]
			.map(([provider, totals]) => ({
				provider,
				name: nameOf(provider),
				...totals,
			}))
			.sort(
				(a, b) =>
					b.cost - a.cost ||
					b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens),
			),
	};
}

/** Same totals, for `useChatMessagesValue` (a fresh object every call otherwise). */
export function sameChatUsage(a: ChatUsage | null, b: ChatUsage | null) {
	return JSON.stringify(a) === JSON.stringify(b);
}

/** Input plus output tokens over a total. */
export const usageTokens = (totals: UsageTotals) =>
	totals.inputTokens + totals.outputTokens;
