import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { ReceiptTextIcon } from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	type ChatUsage,
	chatUsage,
	sameChatUsage,
	type UsageTotals,
	usageTokens,
} from "@/lib/chat/chat-usage";
import { formatTokenCount } from "@/lib/chat/reply-stats";
import { useChatMessagesValue } from "@/lib/chat/use-chat-messages-value";
import { formatCost, formatCostExact } from "@/lib/models/format";

// A chat's running total in its header (roadmap 2.5): what it has cost so far, and per provider in the
// popover. It's the user's money, so the cost leads.

/** "~$0.0123", "$0" for free replies, undefined when no reply had a price. */
function costText(totals: UsageTotals, format = formatCost) {
	if (totals.unpriced === totals.replies) return undefined;
	const amount = format(totals.cost);
	const mark = totals.costEstimated && !amount?.startsWith("<") ? "~" : "";
	return `${mark}${amount}`;
}

const tokensText = (totals: UsageTotals) =>
	`${formatTokenCount(usageTokens(totals))} tokens`;

const repliesText = (count: number) =>
	`${count} ${count === 1 ? "reply" : "replies"}`;

function Row({ label, totals }: { label: string; totals: UsageTotals }) {
	const cost = costText(totals, formatCostExact);
	return (
		<tr>
			<th scope="row" className="py-1 pr-3 text-left font-medium">
				{label}
			</th>
			<td className="py-1 pr-3 text-right text-muted-foreground">
				{repliesText(totals.replies)}
			</td>
			<td className="py-1 pr-3 text-right text-muted-foreground">
				{tokensText(totals)}
			</td>
			<td className="py-1 text-right">{cost ?? "No price"}</td>
		</tr>
	);
}

/** The header button and its per-provider popover, for a chat's totals. */
export function ChatUsageSummary({ usage }: { usage: ChatUsage }) {
	const { total } = usage;
	const cost = costText(total);
	const tokens = tokensText(total);
	const notes = [
		total.costEstimated &&
			"~ marks costs estimated from list prices; your provider's bill is the real figure.",
		total.unpriced > 0 &&
			`${repliesText(total.unpriced)} had no price (a local model, or no list prices).`,
	].filter((note) => typeof note === "string");
	return (
		<Popover>
			<PopoverTrigger
				data-usage="chat"
				aria-label={`This chat: ${[cost, tokens].filter(Boolean).join(", ")}. Usage by provider`}
				className="flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-muted-foreground text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
			>
				{/* A narrow header (a phone, or one of several desktop panes) gives the model name the room
				    and keeps only an icon here; the popover still opens from it. */}
				<ReceiptTextIcon aria-hidden className="@sm/header:hidden size-4" />
				<span data-usage-total className="@sm/header:inline hidden">
					{cost ?? tokens}
					{cost && (
						<span className="@md/header:inline hidden"> · {tokens}</span>
					)}
				</span>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-auto max-w-sm gap-2 text-xs">
				<p className="font-medium text-sm">This chat's usage</p>
				<table className="font-mono">
					<tbody>
						{usage.byProvider.map((provider) => (
							<Row
								key={provider.provider}
								label={provider.name}
								totals={provider}
							/>
						))}
						{usage.byProvider.length > 1 && (
							<Row label="Total" totals={total} />
						)}
					</tbody>
				</table>
				{notes.length > 0 && (
					<p className="max-w-xs text-muted-foreground">{notes.join(" ")}</p>
				)}
			</PopoverContent>
		</Popover>
	);
}

/** The running total for `chat`, once a reply has recorded usage or a cost. */
export function ChatUsageButton({ chat }: { chat: Chat<UIMessage> }) {
	const usage = useChatMessagesValue(chat, chatUsage, sameChatUsage);
	return usage ? <ChatUsageSummary usage={usage} /> : null;
}
