import {
	CopyIcon,
	MoreHorizontalIcon,
	RefreshCcwIcon,
	ThumbsDownIcon,
	ThumbsUpIcon,
} from "lucide-react";
import { Action, Actions } from "@/components/ai-elements/actions";
import { ReplyPromptRow } from "@/components/prompts/reply-prompt";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useReplyVote, voteOnReply } from "@/lib/chat/chat-votes";
import { type ReplyDetail, replyDetails } from "@/lib/chat/reply-details";
import { logWarn } from "@/lib/log";
import { type PromptSource, replyPromptSource } from "@/lib/prompts/provenance";
import { chatStore } from "@/lib/storage/app-store";
import type { ReplyVote } from "@/lib/storage/votes";
import type { MessageUIProps } from "@/types/types";
import { HIDE_WHILE_BUSY, VersionSwitcher } from "./user-message-actions";

export type MessageActionsProps = MessageUIProps & {
	/** Regenerates this reply into a new version (roadmap R4). Hidden while the chat is busy. */
	onRegenerate?: () => void;
	/** This reply's versions, oldest first, when it has been regenerated. */
	versionIds?: readonly string[];
	/** Shows another version. Ignored while the chat is busy. */
	onSwitch?: (versionId: string) => void;
	/** The reply's chat, for its thumbs up/down (roadmap 3.4). No vote buttons without it. */
	chatId?: string;
};

function textOf(message: MessageUIProps["message"]): string {
	return message.parts
		.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("\n\n");
}

/**
 * The "⋯" on a reply's action row (roadmap 2.5b): its model, host, cost, tokens and timings, and the
 * saved prompt version it was sent with (3.6b).
 */
function ReplyDetailsButton({
	details,
	promptSource,
}: {
	details: ReplyDetail[];
	promptSource: PromptSource | undefined;
}) {
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
					{promptSource && <ReplyPromptRow source={promptSource} />}
				</dl>
			</PopoverContent>
		</Popover>
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
	chatId,
	versionIds,
	onSwitch,
}: MessageActionsProps) => {
	const handleCopy = () => {
		navigator.clipboard
			.writeText(textOf(message))
			.catch((error) => logWarn("Couldn't copy the reply:", error));
	};
	const details = replyDetails(message.metadata);
	const promptSource = replyPromptSource(message.metadata);
	return (
		message.role === "assistant" && (
			// No side padding and -ml-2 (the icon buttons' own inset) line the copy icon up with the reply
			// text. Model, host, cost and timings all sit behind "⋯", so the row stays one line.
			<Actions className="-ml-2 px-0">
				{versionIds && (
					// Hidden while a reply streams, by CSS, like the person's own switcher (roadmap 1.7).
					<div className={HIDE_WHILE_BUSY}>
						<VersionSwitcher
							messageId={message.id}
							versionIds={versionIds}
							onSwitch={onSwitch}
							label="Reply versions"
						/>
					</div>
				)}
				<Action onClick={handleCopy} tooltip="Copy to clipboard">
					<CopyIcon className="size-4" />
				</Action>
				{onRegenerate && (
					<Action
						onClick={onRegenerate}
						tooltip="Regenerate response"
						className={HIDE_WHILE_BUSY}
					>
						<RefreshCcwIcon className="size-4" />
					</Action>
				)}
				{chatId && <ReplyVoteButtons chatId={chatId} messageId={message.id} />}
				{details && (
					<ReplyDetailsButton details={details} promptSource={promptSource} />
				)}
			</Actions>
		)
	);
};

export default MessageActions;
