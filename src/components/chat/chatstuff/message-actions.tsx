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
import type { MessageUIProps } from "@/types/types";

export type MessageActionsProps = MessageUIProps & {
	/** Set on the reply that can be regenerated (the last one, once it has finished). */
	onRegenerate?: () => void;
	/** The chat's model now; a reply from another model names its own. */
	currentModel?: CurrentModel;
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

const MessageActions = ({
	message,
	onRegenerate,
	currentModel,
}: MessageActionsProps) => {
	const handleCopy = () => {
		navigator.clipboard
			.writeText(textOf(message))
			.catch((error) => logWarn("Couldn't copy the reply:", error));
	};
	const handleThumbsUp = () => {};
	const handleThumbsDown = () => {};
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
				<Action onClick={handleThumbsUp} tooltip="Good response">
					<ThumbsUpIcon className="size-4" />
				</Action>
				<Action onClick={handleThumbsDown} tooltip="Bad response">
					<ThumbsDownIcon className="size-4" />
				</Action>
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
