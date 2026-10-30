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
import MessageUI from "./message-ui";

type Message = UIMessage<unknown, UIDataTypes, UITools>;

type MessagesListProps = {
	messages: Message[];
	/** Regenerates the last reply. Leave unset while a reply is streaming. */
	onRegenerate?: (messageId: string) => void;
	/** The chat's model now, so replies from another model can say which. */
	currentModel?: CurrentModel;
};

// Memoized so a streaming reply re-renders only its own row: the SDK replaces just the message that
// changed, so finished ones keep their identity (and `currentModel` is kept by value upstream).
const MessageRow = memo(function MessageRow({
	message,
	onRegenerate,
	currentModel,
}: {
	message: Message;
	onRegenerate?: () => void;
	currentModel?: CurrentModel;
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
			/>
		</MessageScrollerItem>
	);
});

const MessagesList = ({
	messages,
	onRegenerate,
	currentModel,
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
					{messages.map((message) => (
						<MessageRow
							key={message.id}
							message={message}
							onRegenerate={message === last ? regenerate : undefined}
							currentModel={currentModel}
						/>
					))}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>
		</div>
	);
};

export default MessagesList;
