import type { UIMessage } from "@ai-sdk/react";
import type { UIDataTypes, UITools } from "ai";

type MessagesListProps = {
	messages: UIMessage<unknown, UIDataTypes, UITools>[];
};
const MessagesList = ({ messages }: MessagesListProps) => {
	console.log("MessagesList messages:", messages);
	return <div>MessagesList</div>;
};

export default MessagesList;
