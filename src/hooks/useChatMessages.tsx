import { useRouter } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const useChatMessages = () => {
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const router = useRouter();
	const createConversation = useMutation(api.conversations.create);
	const sendUserMessage = useMutation(api.messages.sendUserMessage);
	const createAssistantMessage = useMutation(
		api.messages.createAssistantMessage,
	);

	const createNewChat = async (content: string) => {
		setIsCreating(true);
		setError(null);
		try {
			const conversationId = await createConversation({
				title: content.slice(0, 50),
			});

			const userMessageId = await sendUserMessage({
				conversationId,
				content,
			});

			const assistantMessageId = await createAssistantMessage({
				conversationId,
				parentId: userMessageId,
				model: "zai-org/glm-4.6v-flash",
				modelProvider: "lmstudio",
			});

			await router.navigate({
				to: "/$chatId",
				params: { chatId: conversationId },
				search: { initialMessage: content, assistantMessageId },
			});

			return { conversationId, assistantMessageId };
		} catch (err) {
			const error =
				err instanceof Error ? err : new Error("Failed to create chat");
			setError(error);
			throw error; // Re-throw so component can handle it
		} finally {
			setIsCreating(false);
		}
	};

	const sendChatMessage = async (
		conversationId: Id<"conversations">,
		content: string,
	) => {
		setError(null);
		try {
			const userMessageId = await sendUserMessage({
				conversationId,
				content,
			});

			const assistantMessageId = await createAssistantMessage({
				conversationId,
				parentId: userMessageId,
				model: "zai-org/glm-4.6v-flash",
				modelProvider: "lmstudio",
			});

			return { userMessageId, assistantMessageId };
		} catch (err) {
			const error =
				err instanceof Error ? err : new Error("Failed to send message");
			setError(error);
			throw error;
		}
	};

	return {
		createNewChat,
		sendUserMessage,
		createAssistantMessage,
		sendChatMessage,
		isCreating,
		error,
		clearError: () => setError(null),
	};
};
