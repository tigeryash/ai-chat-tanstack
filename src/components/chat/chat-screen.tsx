import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { ChatView } from "@/components/chat/chat-view";
import { HostSwitcher } from "@/components/models/host-switcher";
import { LocalModelCard, ModelCard } from "@/components/models/model-card";
import { ModelPicker } from "@/components/models/model-picker";
import { RemovedModelBanner } from "@/components/models/removed-model-banner";
import { useChatModel } from "@/components/models/use-chat-model";
import { storeChatModelChoice } from "@/lib/chat/chat-model-choice";
import { LOCAL_PROVIDER } from "@/lib/chat/model-selection";
import { useLocalEndpointFor } from "@/lib/local-endpoints/endpoints";

/** A chat with its model picker above it, and the model's card while the chat is empty. */
export function ChatScreen({
	chat,
	onSend,
}: {
	chat: Chat<UIMessage>;
	onSend?: () => void;
}) {
	// No `useChat` here: the header shouldn't re-render per streamed chunk. ChatView subscribes.
	const model = useChatModel(chat);
	const { choice, wanted, chosenModel } = model;
	const isLocal = choice?.provider === LOCAL_PROVIDER && choice.model !== "";
	const localEndpoint = useLocalEndpointFor(
		isLocal ? choice.endpoint : undefined,
	);

	const handleSend = () => {
		// Pin the chat to the model it was sent with, even if the default changes later. Its host
		// settings (Auto or a pinned host) are kept as picked, so Auto keeps re-checking hosts.
		if (wanted) storeChatModelChoice(chat.id, wanted);
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
	} else if (isLocal) {
		empty = <LocalModelCard model={choice.model} endpoint={localEndpoint} />;
	} else if (choice?.model) {
		empty = "Send a message to start.";
	}

	return (
		<ChatView
			chat={chat}
			selection={model.selection}
			onSend={handleSend}
			empty={empty}
			header={
				<>
					<div className="flex w-full items-center gap-1 px-2 py-1">
						<ModelPicker
							choice={choice}
							wanted={wanted}
							needs={model.needs}
							chosenModel={chosenModel}
							onChange={model.setChoice}
							catalog={model.catalog}
							connected={model.connected}
						/>
						{choice && chosenModel && model.runnable && (
							<HostSwitcher
								choice={choice}
								hosts={model.hosts}
								onChange={model.setChoice}
							/>
						)}
						{isLocal && (
							<span className="text-muted-foreground text-xs">
								via{" "}
								{localEndpoint?.name ??
									(choice.endpoint ? "a removed local server" : "Local")}
							</span>
						)}
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
