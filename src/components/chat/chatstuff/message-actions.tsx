import {
	CopyIcon,
	RefreshCcwIcon,
	ThumbsDownIcon,
	ThumbsUpIcon,
} from "lucide-react";
import { Action, Actions } from "@/components/ai-elements/actions";
import type { MessageUIProps } from "@/types/types";

const MessageActions = ({ message }: MessageUIProps) => {
	const handleCopy = () => {};
	const handleRegenerate = () => {};
	const handleThumbsUp = () => {};
	const handleThumbsDown = () => {};
	return (
		message.role === "assistant" && (
			<Actions>
				<Action onClick={handleCopy} tooltip="Copy to clipboard">
					<CopyIcon className="size-4" />
				</Action>
				<Action onClick={handleRegenerate} tooltip="Regenerate response">
					<RefreshCcwIcon className="size-4" />
				</Action>
				<Action onClick={handleThumbsUp} tooltip="Good response">
					<ThumbsUpIcon className="size-4" />
				</Action>
				<Action onClick={handleThumbsDown} tooltip="Bad response">
					<ThumbsDownIcon className="size-4" />
				</Action>
			</Actions>
		)
	);
};

export default MessageActions;
