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
import { type ReplyDetail, replyDetails } from "@/lib/chat/reply-details";
import { logWarn } from "@/lib/log";
import type { MessageUIProps } from "@/types/types";

export type MessageActionsProps = MessageUIProps & {
	/** Set on the reply that can be regenerated (the last one, once it has finished). */
	onRegenerate?: () => void;
};

function textOf(message: MessageUIProps["message"]): string {
	return message.parts
		.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("\n\n");
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

const MessageActions = ({ message, onRegenerate }: MessageActionsProps) => {
	const handleCopy = () => {
		navigator.clipboard
			.writeText(textOf(message))
			.catch((error) => logWarn("Couldn't copy the reply:", error));
	};
	const handleThumbsUp = () => {};
	const handleThumbsDown = () => {};
	const details = replyDetails(message.metadata);
	return (
		message.role === "assistant" && (
			// No side padding and -ml-2 (the icon buttons' own inset) line the copy icon up with the reply
			// text. Model, host, cost and timings all sit behind "⋯", so the row stays one line.
			<Actions className="-ml-2 px-0">
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
			</Actions>
		)
	);
};

export default MessageActions;
