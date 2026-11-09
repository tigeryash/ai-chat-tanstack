import type { UIMessage } from "@ai-sdk/react";
import type { UIDataTypes, UITools } from "ai";
import { memo } from "react";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import type { CurrentModel } from "@/lib/chat/reply-summary";
import { type ChatBranches, siblingsAt } from "@/lib/storage/branches";
import MessageUI from "./message-ui";

type Message = UIMessage<unknown, UIDataTypes, UITools>;

type MessagesListProps = {
	messages: Message[];
	/** Regenerates the last reply. Leave unset while a reply is streaming. */
	onRegenerate?: (messageId: string) => void;
	/** The chat's model now, so replies from another model can say which. */
	currentModel?: CurrentModel;
	/** Other versions of edited messages (roadmap 1.7). */
	branches?: ChatBranches;
	/** Sends a new version of a user message. Leave unset while a reply is streaming. */
	onEdit?: (messageId: string, text: string) => void;
	/** Shows another version of the message at `index`. Leave unset while a reply is streaming. */
	onSwitch?: (index: number, versionId: string) => void;
};

// Memoized so a streaming reply re-renders only its own row: the SDK replaces just the message that
// changed, so finished ones keep their identity (and `currentModel` is kept by value upstream).
const MessageRow = memo(function MessageRow({
	message,
	index,
	onRegenerate,
	currentModel,
	versionIds,
	onEdit,
	onSwitch,
}: {
	message: Message;
	index: number;
	onRegenerate?: () => void;
	currentModel?: CurrentModel;
	versionIds?: readonly string[];
	onEdit?: (messageId: string, text: string) => void;
	onSwitch?: (index: number, versionId: string) => void;
}) {
	return (
		// The person's message is the scroll anchor: a new question settles near the top and the reply
		// streams in under it.
		<MessageScrollerItem
			messageId={message.id}
			scrollAnchor={message.role === "user"}
		>
			<MessageUI
				message={message}
				onRegenerate={onRegenerate}
				currentModel={currentModel}
				branching={
					message.role === "user"
						? {
								versionIds,
								onEdit: onEdit && ((text) => onEdit(message.id, text)),
								onSwitch: onSwitch && ((id) => onSwitch(index, id)),
							}
						: undefined
				}
			/>
		</MessageScrollerItem>
	);
});

const MessagesList = ({
	messages,
	onRegenerate,
	currentModel,
	branches,
	onEdit,
	onSwitch,
}: MessagesListProps) => {
	const last = messages.at(-1);
	const regenerate =
		onRegenerate && last?.role === "assistant"
			? () => onRegenerate(last.id)
			: undefined;
	return (
		<div className="flex-1 h-full  ">
			<Conversation className=" relative size-full">
				<ConversationContent className="w-[80%] mx-auto">
					{messages.map((message, index) => (
						<MessageRow
							key={message.id}
							message={message}
							index={index}
							onRegenerate={message === last ? regenerate : undefined}
							currentModel={currentModel}
							// The fork's own list, so its identity holds while a reply streams.
							versionIds={
								branches &&
								siblingsAt(messages as UIMessage[], branches, index)?.ids
							}
							onEdit={message.role === "user" ? onEdit : undefined}
							onSwitch={message.role === "user" ? onSwitch : undefined}
						/>
					))}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>
		</div>
	);
};

export default MessagesList;
