import {
	CopyIcon,
	MoreHorizontalIcon,
	RefreshCcwIcon,
	ThumbsDownIcon,
	ThumbsUpIcon,
} from "lucide-react";
import { Action, Actions } from "@/components/ai-elements/actions";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { type ReplyDetail, replyDetails } from "@/lib/chat/reply-details";
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

/** The "⋯" on a reply's action row (roadmap 2.5b): its model, host, cost, tokens and timings. */
function ReplyDetailsButton({ details }: { details: ReplyDetail[] }) {
	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						aria-label="Reply details"
						size="icon-sm"
						type="button"
						variant="ghost"
					/>
				}
			>
				<MoreHorizontalIcon className="size-4" />
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto max-w-sm gap-2 text-xs">
				<p className="font-medium text-sm">Reply details</p>
				<dl
					data-usage="reply"
					className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1"
				>
					{details.map(({ label, value }) => (
						<div key={label} data-reply-detail className="contents">
							<dt className="text-muted-foreground">{label}</dt>
							<dd className="break-all font-mono">{value}</dd>
						</div>
					))}
				</dl>
			</PopoverContent>
		</Popover>
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
	const details = summary && replyDetails(message.metadata);
	return (
		message.role === "assistant" && (
			// Wraps in a narrow pane rather than overflowing it once the route is on the line. No side
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
				{details && <ReplyDetailsButton details={details} />}
				{summary && (
					// p-1 keeps the button's focus ring inside the pane; -m-1 takes it back off the layout.
					<div className="-my-1 -mr-1 ml-1 min-w-0 p-1 font-mono text-muted-foreground text-xs">
						<ReplyLine summary={summary} />
					</div>
				)}
			</Actions>
		)
	);
};

export default MessageActions;
