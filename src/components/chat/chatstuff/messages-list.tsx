import type { UIMessage } from "@ai-sdk/react";
import type { UIDataTypes, UITools } from "ai";
import { memo } from "react";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { type ChatBranches, siblingsAt } from "@/lib/storage/branches";
import MessageUI from "./message-ui";

type Message = UIMessage<unknown, UIDataTypes, UITools>;

type MessagesListProps = {
	messages: Message[];
	/** Regenerates a reply into a new version (roadmap R4). Ignored while busy; unset with no model. */
	onRegenerate?: (messageId: string) => void;
	/** Other versions of edited messages (roadmap 1.7). */
	branches?: ChatBranches;
	/** Sends a new version of a user message. Leave unset while a reply is streaming. */
	onEdit?: (messageId: string, text: string) => void;
	/** Shows another version of the message at `index`. Ignored while a reply is streaming. */
	onSwitch?: (index: number, versionId: string) => void;
	/** The chat's id, for the replies' thumbs up/down (roadmap 3.4). */
	chatId?: string;
};

// Memoized so a streaming reply re-renders only its own row: the SDK replaces just the message that
// changed, so finished ones keep their identity.
const MessageRow = memo(function MessageRow({
	message,
	index,
	onRegenerate,
	versionIds,
	onEdit,
	onSwitch,
	chatId,
}: {
	chatId?: string;
	message: Message;
	index: number;
	onRegenerate?: (messageId: string) => void;
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
				onRegenerate={onRegenerate && (() => onRegenerate(message.id))}
				chatId={chatId}
				versionIds={message.role === "assistant" ? versionIds : undefined}
				onSwitch={
					message.role === "assistant" && onSwitch
						? (id) => onSwitch(index, id)
						: undefined
				}
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
	branches,
	onEdit,
	onSwitch,
	chatId,
}: MessagesListProps) => {
	return (
		<div className="flex-1 h-full  ">
			<Conversation className=" relative size-full">
				<ConversationContent className="w-[80%] mx-auto">
					{messages.map((message, index) => (
						<MessageRow
							key={message.id}
							message={message}
							index={index}
							chatId={chatId}
							onRegenerate={
								message.role === "assistant" ? onRegenerate : undefined
							}
							// The fork's own list, so its identity holds while a reply streams.
							versionIds={
								branches &&
								siblingsAt(messages as UIMessage[], branches, index)?.ids
							}
							onEdit={message.role === "user" ? onEdit : undefined}
							onSwitch={onSwitch}
						/>
					))}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>
		</div>
	);
};

export default MessagesList;
