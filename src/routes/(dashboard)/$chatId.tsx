import { useChat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import ChatHeader from "@/components/chat/chatstuff/chat-header";
import MessagesList from "@/components/chat/chatstuff/messages-list";
import { Input } from "@/components/chat/input";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/(dashboard)/$chatId")({
	component: RouteComponent,
});

function RouteComponent() {
	const { chatId } = Route.useParams();
	const hasInitialized = useRef(false);
	const pendingAssistantId = useRef<Id<"messages"> | null>(null);

	const convexMessages = useQuery(api.messages.list, {
		conversationId: chatId as Id<"conversations">,
	});

	const updateAssistantMessage = useMutation(
		api.messages.updateAssistantMessage,
	);

	const { messages, sendMessage, status, setMessages } = useChat({
		id: chatId,
		onFinish: async ({ message }) => {
			if (message.role === "assistant" && pendingAssistantId.current) {
				const content = message.parts
					?.filter((p) => p.type === "text")
					.map((p) => p.text)
					.join("");

				await updateAssistantMessage({
					messageId: pendingAssistantId.current,
					content: content || "",
					status: "completed",
				});
			}
		},
	});

	// Sync Convex messages to useChat on initial load
	useEffect(() => {
		if (convexMessages?.length && !hasInitialized.current) {
			hasInitialized.current = true;
			setMessages(
				convexMessages.map((msg) => ({
					id: msg._id,
					role: msg.role as "user" | "assistant",
					content: msg.content || "",
					parts: [{ type: "text" as const, text: msg.content || "" }],
				})),
			);
		}
	}, [convexMessages, setMessages]);

	// Reset when chatId changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: Reset flag when chatId changes
	useEffect(() => {
		hasInitialized.current = false;
	}, [chatId]);

	const isLoading = status === "submitted" || status === "streaming";

	return (
		<div className="flex flex-col h-full items-center pb-4">
			<ChatHeader />
			<div className="flex-1 overflow-auto w-full max-w-3xl">
				{messages.length === 0 ? (
					<div className="flex items-center justify-center h-full text-muted-foreground">
						No messages yet.
					</div>
				) : (
					<MessagesList messages={messages} />
				)}
			</div>
			<Input sendMessage={sendMessage} />
		</div>
	);
}
