import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Input } from "@/components/chat/input";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/(dashboard)/new")({
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const [isCreating, setIsCreating] = useState(false);

	const createConversation = useMutation(api.conversations.create);
	const sendUserMessage = useMutation(api.messages.sendUserMessage);

	const handleNewMessage = async (message: string) => {
		if (isCreating) return;

		setIsCreating(true);
		try {
			// 1. Create conversation
			const conversationId = await createConversation({
				title: message.slice(0, 50),
				model: "glm-4.6v-flash",
				modelProvider: "lmstudio",
			});

			// 2. Save user message
			await sendUserMessage({
				conversationId,
				content: message,
				parts: [{ type: "text", text: message }],
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
