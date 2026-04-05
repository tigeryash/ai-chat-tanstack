import { useChat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef } from "react";
import ChatHeader from "@/components/chat/chatstuff/chat-header";
import MessagesList from "@/components/chat/chatstuff/messages-list";
import { Input } from "@/components/chat/input";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
	convertAISDKPartsToConvex,
	convertConvexPartsToAISDK,
} from "../../utilities/conversions";

export const Route = createFileRoute("/(dashboard)/$chatId")({
	component: RouteComponent,
});

const model = "qwen/qwen3.5-9b";

function RouteComponent() {
	//get chat id from params
	const { chatId } = Route.useParams();
	//find messages that belong to the chat id using convex query
	const convexMessages = useQuery(api.messages.list, {
		conversationId: chatId as Id<"conversations">,
	});
	const userMessages = convexMessages?.filter((m) => m.role === "user");
	const assistantMessages = convexMessages?.filter(
		(m) => m.role === "assistant",
	);

	const shouldBootstrap =
		userMessages?.length === 1 && assistantMessages?.length === 0;

	const { status } = useChat({});

	useEffect(() => {
		if (shouldBootstrap && userMessages) {
		}
	}, [userMessages, shouldBootstrap]);

	const handleSubmit = async ({ message }: { message: string }) => {
		try {
			console.log("Submitting message:", message);
		} catch (error) {
			console.error("Failed to send message:", error);
		}
	};

	const isLoading = status === "submitted" || status === "streaming";

	return (
		<div className="flex h-full flex-col items-center pb-4">
			<ChatHeader />
			<div className="w-full flex-1 overflow-auto">
				{convexMessages?.length === 0 ? (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						No messages yet.
					</div>
				) : (
					<MessagesList messages={convexMessages} />
				)}
			</div>
			<Input onSubmit={handleSubmit} isLoading={isLoading} />
		</div>
	);
}

// const hasInitialized = useRef(false);
// const hasTriggeredInitialResponse = useRef(false);
// const lastUserMessageIdRef = useRef<Id<"messages"> | null>(null);
// const assistantMessageIdRef = useRef<Id<"messages"> | null>(null);

// const convexMessages = useQuery(api.messages.list, {
// 	conversationId: chatId as Id<"conversations">,
// });
// const sendUserMessage = useMutation(api.messages.sendUserMessage);
// const saveAssistantMessage = useMutation(api.messages.createAssistantMessage);
// const updateAssistantMessage = useMutation(api.messages.updateAssistantMessage);

// const { messages, sendMessage, status, setMessages } = useChat({
// 	id: chatId,
// 	onFinish: async ({ message }) => {
// 		const assistantId = assistantMessageIdRef.current;
// 		if (!assistantId) return;

// 		const textContent =
// 			message.parts
// 				?.filter(
// 					(p): p is { type: "text"; text: string; state: "done" } =>
// 						p.type === "text",
// 				)
// 				.map((p) => p.text)
// 				.join("") ?? "";

// 		await updateAssistantMessage({
// 			messageId: assistantId,
// 			content: textContent,
// 			parts: convertAISDKPartsToConvex(message.parts),
// 			status: "completed",
// 		});

// 		assistantMessageIdRef.current = null;
// 	},
// });
// //this causes the messages for useChat to save the first user message.
// useEffect(() => {
// 	if (convexMessages && !hasInitialized.current) {
// 		hasInitialized.current = true;
// 		if (convexMessages.length === 1 && convexMessages[0]?.role === "user") {
// 			lastUserMessageIdRef.current = convexMessages[0]._id;
// 			sendMessage({
// 				role: "user",
// 				parts: [{ type: "text", text: convexMessages[0].content || "" }],
// 			});
// 		} else if (convexMessages.length > 1) {
// 			setMessages(
// 				convexMessages.map((msg) => ({
// 					id: msg._id,
// 					role: msg.role as "user" | "assistant",
// 					content: msg.content || "",
// 					parts: convertConvexPartsToAISDK(msg.parts || []),
// 				})),
// 			);
// 		}
// 	}
// }, [convexMessages, setMessages, sendMessage]);

// useEffect(() => {
// 	const assistantId = assistantMessageIdRef.current;
// 	if (!assistantId) return;

// 	const latestAssistant = [...messages]
// 		.reverse()
// 		.find((m) => m.role === "assistant");
// 	if (!latestAssistant) return;

// 	const content =
// 		latestAssistant.parts
// 			?.filter((p): p is { type: "text"; text: string } => p.type === "text")
// 			.map((p) => p.text)
// 			.join("") ?? "";

// 	const parts = convertAISDKPartsToConvex(latestAssistant.parts);

// 	const timeout = setTimeout(() => {
// 		void updateAssistantMessage({
// 			messageId: assistantId,
// 			status: "streaming",
// 			content,
// 			parts,
// 		});
// 	}, 250);

// 	return () => clearTimeout(timeout);
// }, [messages, updateAssistantMessage]);

// const handleSubmit = useCallback(
// 	async (userMessage: string) => {
// 		try {
// 			const lastMessage = convexMessages?.[convexMessages.length - 1];

// 			// 1) Save user message in Convex first
// 			const userMessageId = await sendUserMessage({
// 				conversationId: chatId as Id<"conversations">,
// 				content: userMessage,
// 				parts: [{ type: "text", text: userMessage }],
// 				parentId: lastMessage?._id,
// 			});

// 			lastUserMessageIdRef.current = userMessageId;

// 			const assistantMessageId = await saveAssistantMessage({
// 				conversationId: chatId as Id<"conversations">,
// 				parentId: userMessageId,
// 				content: "",
// 				parts: [],
// 				model,
// 				modelProvider: "lmstudio",
// 			});

// 			assistantMessageIdRef.current = assistantMessageId;

// 			sendMessage({
// 				id: userMessageId as string,
// 				role: "user",
// 				parts: [{ type: "text", text: userMessage }],
// 			});
// 		} catch (error) {
// 			console.error("Failed to send message:", error);
// 		}
// 	},
// 	[chatId, convexMessages, sendUserMessage, sendMessage, saveAssistantMessage],
// );

// useEffect(() => {
// 	console.log("ChatId changed, resetting state", chatId);
// 	return () => {
// 		hasInitialized.current = false;
// 		hasTriggeredInitialResponse.current = false;
// 		lastUserMessageIdRef.current = null;
// 	};
// }, [chatId]);
