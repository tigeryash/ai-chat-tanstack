import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { ChatView } from "@/components/chat/chat-view";
import { ModelPicker } from "@/components/chat/model-picker";
import { toSelection, useModelChoice } from "@/lib/chat/model-selection";

/** A chat with the (temporary) provider and model picker above it. */
export function ChatScreen({
	chat,
	onSend,
}: {
	chat: Chat<UIMessage>;
	onSend?: () => void;
}) {
	const [choice, setChoice] = useModelChoice();
	return (
		<ChatView
			chat={chat}
			selection={toSelection(choice)}
			onSend={onSend}
			header={<ModelPicker choice={choice} onChange={setChoice} />}
		/>
	);
}
