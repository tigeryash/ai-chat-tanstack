import type { UIMessage } from "@ai-sdk/react";
import type { UIDataTypes, UITools } from "ai";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import MessageUI from "./message-ui";

type MessagesListProps = {
	messages: UIMessage<unknown, UIDataTypes, UITools>[];
};

const MessagesList = ({ messages }: MessagesListProps) => {
	console.log("Rendering MessagesList with messages:", messages);
	return (
		<div className="flex-1 h-full  ">
			<Conversation className=" relative size-full">
				<ConversationContent className="w-[80%] mx-auto">
					{messages.map(({ ...message }) => (
						<MessageUI key={message.id} message={message} />
					))}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>
		</div>
	);
};

export default MessagesList;
