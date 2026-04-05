import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Input } from "@/components/chat/input";
import { api } from "../../../convex/_generated/api";

const model = "qwen/qwen3.5-9b";

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

	const handleNewMessage = async (message: string) => {
		if (isCreating) return;

		setIsCreating(true);
		try {
			// 1. Create conversation
			const conversationId = await createConversation({
				title: message.slice(0, 50),
				model: model,
				modelProvider: "lmstudio",
			});

			// 2. Save user message
			const userMessageId = await sendUserMessage({
				conversationId,
				content: message,
				parts: [{ type: "text", text: message }],
			});

			await createAssistantMessage({
				conversationId,
				parentId: userMessageId,
				model: model,
				modelProvider: "lmstudio",
				content: "",
				parts: [],
			});

			await navigate({
				to: "/$chatId",
				params: { chatId: conversationId },
			});
		} catch (error) {
			console.error("Failed to create chat:", error);
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<div className="flex justify-center items-center h-full flex-col space-y-8 ">
			<h1 className="text-4xl font-semibold">Start a New Chat</h1>
			<Input onSubmit={handleNewMessage} isLoading={isCreating} />
		</div>
	);
}
