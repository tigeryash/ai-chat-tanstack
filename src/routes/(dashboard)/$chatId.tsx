import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import ChatHeader from "@/components/chat/chatstuff/chat-header";
import MessagesList from "@/components/chat/chatstuff/messages-list";
import { Input } from "@/components/chat/input";
import { getClientChatConfig } from "@/utilities/chat-config";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { convertConvexPartsToAISDK } from "../../utilities/conversions";
import { streamAssistantTurn } from "../../utilities/streamAssistantTurn";

export const Route = createFileRoute("/(dashboard)/$chatId")({
	loader: async ({ context, params }) => {
		const conversationId = params.chatId as Id<"conversations">;
		const conversation = await context.queryClient.ensureQueryData(
			convexQuery(api.conversations.get, { id: conversationId }),
		);

		if (!conversation) {
			throw notFound();
		}

		return { conversationId };
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { conversationId } = Route.useLoaderData();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [streamingMessageId, setStreamingMessageId] =
		useState<Id<"messages"> | null>(null);
	const [streamingTextByMessageId, setStreamingTextByMessageId] = useState<
		Partial<Record<Id<"messages">, string>>
	>({});
	const triggeredAssistantMessageIdRef = useRef<Id<"messages"> | null>(null);
	const claimedAssistantMessageIdRef = useRef<Id<"messages"> | null>(null);
	const activeStreamAbortControllerRef = useRef<AbortController | null>(null);
	const activeStreamMessageIdRef = useRef<Id<"messages"> | null>(null);
	const activeConversationIdRef = useRef(conversationId);
	const chatConfig = getClientChatConfig();

	const conversation = useQuery(api.conversations.get, {
		id: conversationId,
	});

	const convexMessages = useQuery(api.messages.list, {
		conversationId,
	});

	const sendUserMessage = useMutation(api.messages.sendUserMessage);
	const createAssistantMessage = useMutation(
		api.messages.createAssistantMessage,
	);
	const updateAssistantMessage = useMutation(
		api.messages.updateAssistantMessage,
	);

	const convexMessagesById = useMemo(
		() =>
			new Map(convexMessages?.map((message) => [message._id, message]) ?? []),
		[convexMessages],
	);

	// Convert Convex docs → UIMessage[] for rendering
	const uiMessages: UIMessage[] = useMemo(
		() =>
			convexMessages?.map((m) => ({
				id: m._id,
				role: m.role as "user" | "assistant",
				parts: convertConvexPartsToAISDK(m.parts),
			})) ?? [],
		[convexMessages],
	);

	const displayMessages: UIMessage[] = useMemo(
		() =>
			uiMessages.map((message) => {
				const overlayText =
					streamingTextByMessageId[message.id as Id<"messages">];
				const convexMessage = convexMessagesById.get(
					message.id as Id<"messages">,
				);

				if (
					message.role !== "assistant" ||
					overlayText === undefined ||
					(convexMessage?.status !== "pending" &&
						convexMessage?.status !== "streaming")
				) {
					return message;
				}

				return {
					...message,
					parts: [{ type: "text", text: overlayText, state: "streaming" }],
				};
			}),
		[convexMessagesById, streamingTextByMessageId, uiMessages],
	);

	const pendingAssistantTurn = useMemo(() => {
		if (!convexMessages || convexMessages.length < 2) {
			return null;
		}

		const assistantMessage = convexMessages[convexMessages.length - 1];
		const parentMessage = convexMessages[convexMessages.length - 2];

		if (
			assistantMessage.role !== "assistant" ||
			assistantMessage.status !== "pending" ||
			claimedAssistantMessageIdRef.current === assistantMessage._id ||
			parentMessage.role !== "user" ||
			assistantMessage.content !== "" ||
			assistantMessage.parts.length > 0
		) {
			return null;
		}

		return {
			assistantMessageId: assistantMessage._id,
			messagesForApi: convexMessages.slice(0, -1).map((message) => ({
				id: message._id,
				role: message.role as "user" | "assistant",
				parts: convertConvexPartsToAISDK(message.parts),
			})) satisfies UIMessage[],
		};
	}, [convexMessages]);

	const isAssistantTurnPending = pendingAssistantTurn !== null;

	useEffect(() => {
		if (activeConversationIdRef.current === conversationId) {
			return;
		}

		activeStreamAbortControllerRef.current?.abort();
		activeStreamAbortControllerRef.current = null;
		activeStreamMessageIdRef.current = null;
		activeConversationIdRef.current = conversationId;
	}, [conversationId]);

	useEffect(
		() => () => {
			activeStreamAbortControllerRef.current?.abort();
			activeStreamAbortControllerRef.current = null;
			activeStreamMessageIdRef.current = null;
		},
		[],
	);

	useEffect(() => {
		if (!convexMessages) {
			return;
		}

		setStreamingTextByMessageId((current) => {
			let nextState: Partial<Record<Id<"messages">, string>> | null = null;

			for (const [messageId, overlayText] of Object.entries(current) as [
				Id<"messages">,
				string,
			][]) {
				const message = convexMessagesById.get(messageId);
				const isCompletedWithCurrentContent =
					message?.role === "assistant" &&
					message.status === "completed" &&
					message.content === overlayText;

				if (
					!message ||
					message.status === "failed" ||
					message.status === "cancelled" ||
					isCompletedWithCurrentContent
				) {
					nextState ??= { ...current };
					delete nextState[messageId];
				}
			}

			return nextState ?? current;
		});
	}, [convexMessages, convexMessagesById]);

	useEffect(() => {
		if (
			pendingAssistantTurn &&
			triggeredAssistantMessageIdRef.current !==
				pendingAssistantTurn.assistantMessageId
		) {
			const abortController = new AbortController();
			let frameId: number | null = null;
			let latestScheduledText: string | null = null;
			const flushOverlayText = (text: string) => {
				setStreamingTextByMessageId((current) =>
					current[pendingAssistantTurn.assistantMessageId] === text
						? current
						: {
								...current,
								[pendingAssistantTurn.assistantMessageId]: text,
							},
				);
			};
			const scheduleOverlayText = (text: string) => {
				latestScheduledText = text;

				if (frameId !== null) {
					return;
				}

				frameId = requestAnimationFrame(() => {
					frameId = null;
					if (latestScheduledText !== null) {
						flushOverlayText(latestScheduledText);
					}
				});
			};

			setStreamingMessageId(pendingAssistantTurn.assistantMessageId);
			claimedAssistantMessageIdRef.current =
				pendingAssistantTurn.assistantMessageId;
			triggeredAssistantMessageIdRef.current =
				pendingAssistantTurn.assistantMessageId;
			activeStreamAbortControllerRef.current?.abort();
			activeStreamAbortControllerRef.current = abortController;
			activeStreamMessageIdRef.current =
				pendingAssistantTurn.assistantMessageId;

			streamAssistantTurn({
				messages: pendingAssistantTurn.messagesForApi,
				assistantMessageId: pendingAssistantTurn.assistantMessageId,
				updateAssistantMessage,
				signal: abortController.signal,
				onUpdate: ({ text, isFinal }) => {
					if (isFinal) {
						if (frameId !== null) {
							cancelAnimationFrame(frameId);
							frameId = null;
						}
						latestScheduledText = null;
						flushOverlayText(text);
						return;
					}

					scheduleOverlayText(text);
				},
			})
				.catch((error) => {
					if (abortController.signal.aborted) {
						return;
					}

					setStreamingTextByMessageId((current) => {
						if (
							current[pendingAssistantTurn.assistantMessageId] === undefined
						) {
							return current;
						}

						const nextState = { ...current };
						delete nextState[pendingAssistantTurn.assistantMessageId];
						return nextState;
					});
					console.error("Failed to stream assistant response:", error);
				})
				.finally(() => {
					if (frameId !== null) {
						cancelAnimationFrame(frameId);
					}
					claimedAssistantMessageIdRef.current =
						claimedAssistantMessageIdRef.current ===
						pendingAssistantTurn.assistantMessageId
							? null
							: claimedAssistantMessageIdRef.current;
					if (
						activeStreamMessageIdRef.current ===
						pendingAssistantTurn.assistantMessageId
					) {
						activeStreamAbortControllerRef.current = null;
						activeStreamMessageIdRef.current = null;
					}
					setStreamingMessageId((current) =>
						current === pendingAssistantTurn.assistantMessageId
							? null
							: current,
					);
				});
		}
	}, [pendingAssistantTurn, updateAssistantMessage]);

	const handleSubmit = async (message: string) => {
		if (
			isSubmitting ||
			isAssistantTurnPending ||
			!convexMessages ||
			!conversation
		) {
			return;
		}

		setIsSubmitting(true);
		try {
			const lastMessage = convexMessages[convexMessages.length - 1];

			const userMessageId = await sendUserMessage({
				conversationId,
				content: message,
				parts: [{ type: "text", text: message }],
				parentId: lastMessage?._id,
			});

			await createAssistantMessage({
				conversationId,
				parentId: userMessageId,
				model: conversation.model ?? chatConfig.model,
				modelProvider: conversation.modelProvider ?? chatConfig.provider,
				content: "",
				parts: [],
			});
		} catch (error) {
			console.error("Failed to send message:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="flex h-full flex-col items-center pb-4">
			<ChatHeader />
			<div className="w-full flex-1 overflow-auto">
				{uiMessages.length === 0 ? (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						No messages yet.
					</div>
				) : (
					<MessagesList messages={displayMessages} />
				)}
			</div>
			<Input
				onSubmit={handleSubmit}
				isLoading={
					isSubmitting || isAssistantTurnPending || streamingMessageId !== null
				}
			/>
		</div>
	);
}
