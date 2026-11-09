import {
	CopyIcon,
	RefreshCcwIcon,
	ThumbsDownIcon,
	ThumbsUpIcon,
} from "lucide-react";
import { Action, Actions } from "@/components/ai-elements/actions";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useReplyVote, voteOnReply } from "@/lib/chat/chat-votes";
import {
	type ReplyStatsSummary,
	replyStatsSummary,
} from "@/lib/chat/reply-stats";
import {
	type CurrentModel,
	type ReplySummary,
	replySummary,
} from "@/lib/chat/reply-summary";
import { logWarn } from "@/lib/log";
import { useCatalogModel } from "@/lib/models/catalog";
import { chatStore } from "@/lib/storage/app-store";
import type { ReplyVote } from "@/lib/storage/votes";
import type { MessageUIProps } from "@/types/types";

export type MessageActionsProps = MessageUIProps & {
	/** Set on the reply that can be regenerated (the last one, once it has finished). */
	onRegenerate?: () => void;
	/** The chat's model now; a reply from another model names its own. */
	currentModel?: CurrentModel;
	/** The reply's chat, for its thumbs up/down (roadmap 3.4). No vote buttons without it. */
	chatId?: string;
};

// Each item after the first gets a "·" in the gap before it. The separator sits outside the item,
// so the group's overflow clip hides it when the item starts a line: a wrapped line never opens with
// "·". The gap is three monospace characters, the width " · " had as text.
const SEPARATED =
	"relative before:absolute before:right-full before:mr-[1ch] before:content-['·'] first:before:content-none";
const SEPARATED_GROUP = "flex flex-wrap gap-x-[3ch] overflow-hidden";

function textOf(message: MessageUIProps["message"]): string {
	return message.parts
		.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("\n\n");
}

/** "via OpenRouter → DeepInfra · $0.0002" (roadmap 2.2b), with every detail in the tooltip. */
function ReplyLine({ summary }: { summary: ReplySummary }) {
	const { data } = useCatalogModel(
		summary.model ? summary.gatewayId : undefined,
	);
	const name = summary.model && (data?.name ?? summary.model);
	const text = [name, summary.route, summary.cost].filter(Boolean).join(" · ");
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						aria-label={`${text}. ${summary.details}`}
						className="rounded text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
					/>
				}
			>
				{text}
			</TooltipTrigger>
			<TooltipContent>
				<p>{summary.details}</p>
			</TooltipContent>
		</Tooltip>
	);
}

/** "1.5K tokens · TTFT 420 ms · 52 tok/s" (roadmap 2.5), with the input/output split in the tooltip. */
function ReplyStatsLine({ stats }: { stats: ReplyStatsSummary }) {
	const items = [stats.tokens, stats.ttft, stats.speed].filter(
		(item) => typeof item === "string" && item.length > 0,
	);
	const text = items.join(" · ");
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						aria-label={`${text}. ${stats.details}`}
						className={`${SEPARATED_GROUP} min-w-0 rounded text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50`}
					/>
				}
			>
				{items.map((item) => (
					<span
						key={item}
						data-usage-item
						className={`${SEPARATED} whitespace-nowrap`}
					>
						{item}
					</span>
				))}
			</TooltipTrigger>
			<TooltipContent>
				<p>{stats.details}</p>
			</TooltipContent>
		</Tooltip>
	);
}

/** Thumbs up/down (roadmap 3.4), saved with the chat on this device. Pressing a vote again clears it. */
function ReplyVoteButtons({
	chatId,
	messageId,
}: {
	chatId: string;
	messageId: string;
}) {
	const vote = useReplyVote(chatId, messageId);
	const toggle = (pressed: ReplyVote) => {
		voteOnReply(
			chatId,
			messageId,
			vote === pressed ? null : pressed,
			chatStore(),
		);
	};
	return (
		<>
			<Action
				onClick={() => toggle("up")}
				tooltip="Good response"
				aria-pressed={vote === "up"}
				data-vote={vote === "up" ? "up" : undefined}
				className={vote === "up" ? "text-foreground" : undefined}
			>
				<ThumbsUpIcon
					className={`size-4 ${vote === "up" ? "fill-current" : ""}`}
				/>
			</Action>
			<Action
				onClick={() => toggle("down")}
				tooltip="Bad response"
				aria-pressed={vote === "down"}
				data-vote={vote === "down" ? "down" : undefined}
				className={vote === "down" ? "text-foreground" : undefined}
			>
				<ThumbsDownIcon
					className={`size-4 ${vote === "down" ? "fill-current" : ""}`}
				/>
			</Action>
		</>
	);
}

const MessageActions = ({
	message,
	onRegenerate,
	currentModel,
	chatId,
}: MessageActionsProps) => {
	const handleCopy = () => {
		navigator.clipboard
			.writeText(textOf(message))
			.catch((error) => logWarn("Couldn't copy the reply:", error));
	};
	const summary = replySummary(message.metadata, currentModel);
	const stats = summary && replyStatsSummary(message.metadata);
	return (
		message.role === "assistant" && (
			// Wraps in a narrow pane rather than overflowing it once the stats are on the line. No side
			// padding and -ml-2 (the icon buttons' own inset) line the copy icon up with the reply text.
			<Actions className="-ml-2 flex-wrap gap-y-1 px-0">
				<Action onClick={handleCopy} tooltip="Copy to clipboard">
					<CopyIcon className="size-4" />
				</Action>
				{onRegenerate && (
					<Action onClick={onRegenerate} tooltip="Regenerate response">
						<RefreshCcwIcon className="size-4" />
					</Action>
				)}
				{chatId && <ReplyVoteButtons chatId={chatId} messageId={message.id} />}
				{summary && (
					// p-1 keeps the buttons' focus rings inside the clip; -m-1 takes it back off the layout.
					<div
						className={`${SEPARATED_GROUP} -my-1 -mr-1 ml-1 min-w-0 p-1 font-mono text-muted-foreground text-xs`}
					>
						<div className={SEPARATED}>
							<ReplyLine summary={summary} />
						</div>
						{stats && (
							<div data-usage="reply" className={`${SEPARATED} flex min-w-0`}>
								<ReplyStatsLine stats={stats} />
							</div>
						)}
					</div>
				)}
			</Actions>
		)
	);
};

export default MessageActions;
