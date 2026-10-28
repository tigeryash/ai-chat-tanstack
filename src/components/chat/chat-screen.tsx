import { type Chat, useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { ChatView } from "@/components/chat/chat-view";
import { LocalModelCard, ModelCard } from "@/components/models/model-card";
import { ModelPicker } from "@/components/models/model-picker";
import { RemovedModelBanner } from "@/components/models/removed-model-banner";
import { useChatModel } from "@/components/models/use-chat-model";
import { storeChatModelChoice } from "@/lib/chat/chat-model-choice";
import { LOCAL_PROVIDER, toSelection } from "@/lib/chat/model-selection";

/** A chat with its model picker above it, and the model's card while the chat is empty. */
export function ChatScreen({
	chat,
	onSend,
}: {
	chat: Chat<UIMessage>;
	onSend?: () => void;
}) {
	const { messages } = useChat({ chat });
	const model = useChatModel(chat.id, messages);
	const { choice, chosenModel } = model;

	const handleSend = () => {
		// Pin the chat to the model it was sent with, even if the default changes later.
		if (choice) storeChatModelChoice(chat.id, choice);
		onSend?.();
	};

	let empty: React.ReactNode = "Pick a model to start.";
	if (chosenModel) {
		empty = (
			<ModelCard
				model={chosenModel}
				via={model.runnable ? choice?.provider : undefined}
			/>
		);
	} else if (choice?.provider === LOCAL_PROVIDER && choice.model) {
		empty = <LocalModelCard model={choice.model} />;
	} else if (choice?.model) {
		empty = "Send a message to start.";
	}

	return (
		<ChatView
			chat={chat}
			selection={toSelection(choice)}
			onSend={handleSend}
			empty={empty}
			header={
				<>
					<div className="flex w-full items-center px-2 py-1">
						<ModelPicker
							choice={choice}
							chosenModel={chosenModel}
							onChange={model.setChoice}
							catalog={model.catalog}
							connected={model.connected}
						/>
					</div>
					{chosenModel?.status === "removed" && (
						<RemovedModelBanner
							model={chosenModel}
							replacement={model.replacement}
							onSwitch={model.switchTo}
						/>
					)}
				</>
			}
		/>
	);
}
