import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { costText } from "@/lib/chat/chat-usage";
import { useChatMessagesValue } from "@/lib/chat/use-chat-messages-value";
import { formatLatency, formatSpeed } from "@/lib/models/format";
import {
	type PaneStats,
	paneStats,
	samePaneStats,
} from "@/lib/workspaces/pane-stats";

// A pane's compare line (roadmap 3.4), under its header: the latest reply's TTFT and tokens/sec and the
// chat's cost, so panes line up at a glance. The averages are in its title and accessible name.

function statsText(stats: PaneStats) {
	const ttft = formatLatency(stats.last.ttftMs);
	const speed = formatSpeed(stats.last.tokensPerSecond);
	const cost = stats.usage ? costText(stats.usage.total) : undefined;
	const shown = [ttft && `TTFT ${ttft}`, speed, cost].filter(
		(item): item is string => typeof item === "string",
	);
	const avgTtft = formatLatency(stats.avgTtftMs);
	const avgSpeed = formatSpeed(stats.avgTokensPerSecond);
	const averages =
		stats.timedReplies > 1
			? [avgTtft && `TTFT ${avgTtft}`, avgSpeed].filter(Boolean).join(", ")
			: "";
	const details = [
		shown.length > 0 && `Latest reply: ${shown.join(", ")}`,
		averages && `average over ${stats.timedReplies} replies: ${averages}`,
	]
		.filter(Boolean)
		.join("; ");
	return { shown, details };
}

export function PaneStatsLine({
	chat,
	label,
}: {
	chat: Chat<UIMessage>;
	/** "Pane 2". */
	label: string;
}) {
	const stats = useChatMessagesValue(chat, paneStats, samePaneStats);
	if (!stats) return null;
	const { shown, details } = statsText(stats);
	if (shown.length === 0) return null;
	return (
		<div
			data-usage="pane"
			data-pane-stats
			title={details}
			className="truncate border-t px-3 py-1 font-mono text-muted-foreground text-xs"
		>
			<span aria-hidden>{shown.join(" · ")}</span>
			<span className="sr-only">
				{label} stats. {details}
			</span>
		</div>
	);
}
