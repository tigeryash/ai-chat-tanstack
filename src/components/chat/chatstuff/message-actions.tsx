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
						className="ml-2 rounded font-mono text-muted-foreground text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
	return (
		message.role === "assistant" && (
			<Actions>
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
				{summary && <ReplyLine summary={summary} />}
			</Actions>
		)
	);
};

export default MessageActions;
