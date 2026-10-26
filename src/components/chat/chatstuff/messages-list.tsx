import type { UIMessage } from "@ai-sdk/react";
import type { UIDataTypes, UITools } from "ai";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import MessageUI from "./message-ui";

type MessagesListProps = {
	messages: UIMessage<unknown, UIDataTypes, UITools>[];
};

const MessagesList = ({ messages }: MessagesListProps) => {
	// console.log("Rendering MessagesList with messages:", messages);
	return (
		<div className="flex-1 h-full  ">
			<Conversation className=" relative size-full">
				<ConversationContent className="w-[80%] mx-auto">
					{messages.map(({ ...message }) => (
						// The person's message is the scroll anchor: a new question settles near the top and
						// the reply streams in under it.
						<MessageScrollerItem
							key={message.id}
							messageId={message.id}
							scrollAnchor={message.role === "user"}
						>
							<MessageUI message={message} />
						</MessageScrollerItem>
					))}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>
		</div>
	);
};

export default MessagesList;
