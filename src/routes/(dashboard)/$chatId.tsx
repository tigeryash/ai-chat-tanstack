import { useChat } from "@ai-sdk/react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import ChatHeader from "@/components/chat/chatstuff/chat-header";
import MessagesList from "@/components/chat/chatstuff/messages-list";
import { Input } from "@/components/chat/input";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/(dashboard)/$chatId")({
	component: RouteComponent,
	validateSearch: (search: Record<string, unknown>) => ({
		initialMessage: search.initialMessage as string | undefined,
		assistantMessageId: search.assistantMessageId as string | undefined,
	}),
});

function RouteComponent() {
	const { chatId } = Route.useParams();
	const { initialMessage, assistantMessageId } = useSearch({
		from: "/(dashboard)/$chatId",
	});

	const hasInitialized = useRef(false);
	const hasSentInitialMessage = useRef(false);
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
				// Extract text content for the content field
				const textContent =
					message.parts
						?.filter(
							(p): p is { type: "text"; text: string } => p.type === "text",
						)
						.map((p) => p.text)
						.join("") || "";

				// Convert parts to match Convex schema, filtering out unsupported types
				const convexParts =
					message.parts
						?.map((part) => {
							if (part.type === "text") {
								return {
									type: "text" as const,
									text: part.text,
									state: "done" as const,
								};
							}
							if (part.type === "reasoning") {
								return {
									type: "reasoning" as const,
									text: (part as any).text,
									state: "done" as const,
								};
							}
							if (part.type === "step-start") {
								return { type: "step-start" as const };
							}
							// Filter out unsupported part types
							return null;
						})
						.filter(
							(
								part,
							): part is
								| { type: "text"; text: string; state: "done" }
								| { type: "reasoning"; text: string; state: "done" }
								| { type: "step-start" } => part !== null,
						) || [];

				await updateAssistantMessage({
					messageId: pendingAssistantId.current,
					content: textContent,
					parts: convexParts,
					status: "completed",
				});
				pendingAssistantId.current = null;
			}
		},
	});

	// Sync Convex messages to useChat on initial load
	useEffect(() => {
		if (
			convexMessages &&
			convexMessages.length > 0 &&
			!hasInitialized.current
		) {
			hasInitialized.current = true;
			setMessages(
				convexMessages.map((msg) => ({
					id: msg._id,
					role: msg.role as "user" | "assistant",
					content: msg.content || "",
					parts: msg.parts?.length
						? msg.parts.map((p) => {
								if (p.type === "text")
									return { type: "text" as const, text: p.text };
								if (p.type === "reasoning")
									return { type: "reasoning" as const, text: p.text };
								if (p.type === "step-start")
									return { type: "step-start" as const };
								return p as any;
							})
						: [{ type: "text" as const, text: msg.content || "" }],
				})),
			);
		}
	}, [convexMessages, setMessages]);

	// Trigger AI call for initial message from /new route
	useEffect(() => {
		// Only trigger if we have the search params AND messages are initialized AND status is ready
		if (
			convexMessages &&
			initialMessage &&
			assistantMessageId &&
			hasInitialized.current &&
			!hasSentInitialMessage.current &&
			status === "ready"
		) {
			hasSentInitialMessage.current = true;
			pendingAssistantId.current = assistantMessageId as Id<"messages">;

			// Send to AI
			sendMessage({
				role: "user",
				parts: [{ type: "text", text: initialMessage }],
			});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialMessage, assistantMessageId, status, sendMessage, convexMessages]);

	// Reset refs when chatId changes
	useEffect(() => {
		return () => {
			console.log(`Resetting session state for chat: ${chatId}`);
			hasInitialized.current = false;
			hasSentInitialMessage.current = false;
			pendingAssistantId.current = null;
		};
	}, [chatId]);

	const isLoading = status === "submitted" || status === "streaming";

	return (
		<div className="flex flex-col h-full items-center pb-4 ">
			<ChatHeader />
			<div className="flex-1 overflow-auto w-full">
				{messages.length === 0 ? (
					<div className="flex items-center justify-center h-full text-muted-foreground">
						No messages yet.
					</div>
				) : (
					<MessagesList messages={messages} />
				)}
			</div>
			<Input
				sendMessage={sendMessage}
				pendingAssistantIdRef={pendingAssistantId}
				chatId={chatId}
			/>
		</div>
	);
}
