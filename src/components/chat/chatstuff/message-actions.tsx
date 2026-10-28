import {
	CopyIcon,
	RefreshCcwIcon,
	ThumbsDownIcon,
	ThumbsUpIcon,
} from "lucide-react";
import { Action, Actions } from "@/components/ai-elements/actions";
import type { ReplyMetadata } from "@/lib/chat/browser-transport";
import { LOCAL_PROVIDER, providerName } from "@/lib/chat/model-selection";
import { logWarn } from "@/lib/log";
import { formatCost } from "@/lib/models/format";
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

/** "model · OpenRouter · via DeepInfra · $0.0012" (roadmap 2.2b); older replies show less. */
function modelLabel(metadata: unknown): string | null {
	const reply = metadata as Partial<ReplyMetadata> | undefined;
	if (!reply?.provider || !reply.model) return null;
	const provider =
		reply.provider === LOCAL_PROVIDER ? "Local" : providerName(reply.provider);
	const cost =
		typeof reply.cost === "number" ? formatCost(reply.cost) : undefined;
	return [
		reply.model,
		provider,
		typeof reply.host === "string" && `via ${reply.host}`,
		cost && (reply.costEstimated ? `~${cost}` : cost),
	]
		.filter(Boolean)
		.join(" · ");
}

const MessageActions = ({ message, onRegenerate }: MessageActionsProps) => {
	const handleCopy = () => {
		navigator.clipboard
			.writeText(textOf(message))
			.catch((error) => logWarn("Couldn't copy the reply:", error));
	};
	const handleThumbsUp = () => {};
	const handleThumbsDown = () => {};
	const model = modelLabel(message.metadata);
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
				{model && (
					<span className="ml-2 text-xs text-muted-foreground">{model}</span>
				)}
			</Actions>
		)
	);
};

export default MessageActions;
