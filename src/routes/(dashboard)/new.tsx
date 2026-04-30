import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Input } from "@/components/chat/input";
import { getClientChatConfig } from "@/utilities/chat-config";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/(dashboard)/new")({
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const [isCreating, setIsCreating] = useState(false);

	const createConversation = useMutation(api.conversations.create);
	const sendUserMessage = useMutation(api.messages.sendUserMessage);
	const createAssistantMessage = useMutation(
		api.messages.createAssistantMessage,
	);
	const chatConfig = getClientChatConfig();

	const handleNewMessage = async (message: string) => {
		if (isCreating) return;

		setIsCreating(true);
		try {
			const conversationId = await createConversation({
				title: message.slice(0, 50),
				model: chatConfig.model,
				modelProvider: chatConfig.provider,
			});

			const userMessageId = await sendUserMessage({
				conversationId,
				content: message,
				parts: [{ type: "text", text: message }],
			});

			await createAssistantMessage({
				conversationId,
				parentId: userMessageId,
				model: chatConfig.model,
				modelProvider: chatConfig.provider,
				content: "",
				parts: [],
			});

			await navigate({ to: "/$chatId", params: { chatId: conversationId } });
		} catch (error) {
			console.error("Failed to create chat:", error);
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<div className="flex justify-center items-center h-full flex-col space-y-8">
			<h1 className="text-4xl font-semibold">Start a New Chat</h1>
			<Input onSubmit={handleNewMessage} isLoading={isCreating} />
		</div>
	);
}
