import {
	formatCostExact,
	formatLatency,
	formatSpeed,
} from "@/lib/models/format";
import type { ReplyMetadata } from "./browser-transport";
import { LOCAL_PROVIDER, providerName } from "./model-selection";
import { readReplyStats, totalTokens } from "./reply-stats";

// Everything recorded about one reply (roadmap 2.5b), for the "⋯" popover on its action row: the
// model, host and cost from 2.2b and the tokens and timings from 2.5. Nothing shows inline under a
// reply; it all lives here.

export interface ReplyDetail {
	label: string;
	value: string;
}

const COUNT = new Intl.NumberFormat("en");

function hostName(provider: ReplyMetadata["provider"]): string {
	return provider === LOCAL_PROVIDER ? "Local" : providerName(provider);
}

function costValue(reply: Partial<ReplyMetadata>): string {
	const exact = formatCostExact(
		typeof reply.cost === "number" ? reply.cost : undefined,
	);
	if (!exact) return "No price";
	return reply.costEstimated && !exact.startsWith("<")
		? `~${exact} (estimated from list prices)`
		: exact;
}

function hostValue(reply: Partial<ReplyMetadata>): string | undefined {
	if (!reply.provider) return undefined;
	const provider = hostName(reply.provider);
	return typeof reply.host === "string"
		? `${provider} → ${reply.host}`
		: provider;
}

/** The token, timing and speed rows; empty for replies saved before 2.5. */
function statsRows(metadata: unknown): ReplyDetail[] {
	const stats = readReplyStats(metadata);
	if (!stats) return [];
	const { usage } = stats;
	const total = totalTokens(usage);
	const part = (
		count: number | undefined,
		extra: number | undefined,
		kind: string,
	) =>
		count === undefined
			? undefined
			: `${COUNT.format(count)}${extra ? ` (${COUNT.format(extra)} ${kind})` : ""}`;
	return [
		{
			label: "Tokens",
			value: total === undefined ? undefined : COUNT.format(total),
		},
		{
			label: "Input",
			value: part(usage?.inputTokens, usage?.cachedInputTokens, "cached"),
		},
		{
			label: "Output",
			value: part(usage?.outputTokens, usage?.reasoningTokens, "reasoning"),
		},
		{ label: "Time to first token", value: formatLatency(stats.ttftMs) },
		{ label: "Speed", value: formatSpeed(stats.tokensPerSecond) },
	].filter((row): row is ReplyDetail => typeof row.value === "string");
}

/** Null for replies saved before metadata was recorded (saved and imported chats are untrusted). */
export function replyDetails(metadata: unknown): ReplyDetail[] | null {
	const reply = metadata as Partial<ReplyMetadata> | undefined;
	if (typeof reply?.model !== "string") return null;
	const host = hostValue(reply);
	if (!host) return null;
	return [
		{ label: "Model", value: reply.model },
		{ label: "Host", value: host },
		{ label: "Cost", value: costValue(reply) },
		...statsRows(metadata),
	];
}
