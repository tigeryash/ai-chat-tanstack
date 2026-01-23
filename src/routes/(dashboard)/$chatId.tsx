import { useChat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef } from "react";
import ChatHeader from "@/components/chat/chatstuff/chat-header";
import MessagesList from "@/components/chat/chatstuff/messages-list";
import { Input } from "@/components/chat/input";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/(dashboard)/$chatId")({
  component: RouteComponent,
});

function convertConvexPartsToAISDK(parts: any[]) {
  return parts?.length
    ? parts.map((p) => {
        if (p.type === "text")
          return { type: "text" as const, text: p.text, state: p.state };
        if (p.type === "reasoning")
          return { type: "reasoning" as const, text: p.text, state: p.state };
        if (p.type === "step-start") return { type: "step-start" as const };
        return p as any;
      })
    : [];
}

function convertAISDKPartsToConvex(parts: any[]) {
  return (
    parts
      ?.map((part) => {
        if (part.type === "text")
          return {
            type: "text" as const,
            text: part.text,
            state: "done" as const,
          };
        if (part.type === "reasoning")
          return {
            type: "reasoning" as const,
            text: (part as any).text,
            state: "done" as const,
          };
        if (part.type === "step-start") return { type: "step-start" as const };
        return null;
      })
      .filter((part): part is any => part !== null) || []
  );
}

function RouteComponent() {
  const { chatId } = Route.useParams();

  const hasInitialized = useRef(false);
  const hasTriggeredInitialResponse = useRef(false);

  const convexMessages = useQuery(api.messages.list, {
    conversationId: chatId as Id<"conversations">,
  });
  const sendUserMessage = useMutation(api.messages.sendUserMessage);
  const saveAssistantMessage = useMutation(api.messages.createAssistantMessage);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: chatId,
    onFinish: async ({ message, messages }) => {
      if (message.role === "assistant") {
        const textContent =
          message.parts
            ?.filter(
              (p): p is { type: "text"; text: string } => p.type === "text",
            )
            .map((p) => p.text)
            .join("") || "";

        const convexParts = convertAISDKPartsToConvex(message.parts || []);

        // Get last user message as parent
        const lastUserMessage = messages
          ?.slice()
          .reverse()
          .find((m) => m.role === "user");
        console.log(lastUserMessage);

        // Save completed assistant message to Convex

        if (lastUserMessage?.id) {
          await saveAssistantMessage({
            conversationId: chatId as Id<"conversations">,
            parentId: lastUserMessage.id as Id<"messages">,
            content: textContent,
            parts: convexParts,
            model: "glm-4.6v-flash",
            modelProvider: "lmstudio",
          });
        } else {
          console.error(
            "Cannot save assistant message: no parent user message found",
          );
        }
      }
    },
  });
  //this causes the messages for useChat to save the first user message.
  useEffect(() => {
    if (convexMessages && !hasInitialized.current) {
      hasInitialized.current = true;
      if (convexMessages.length === 1 && convexMessages[0]?.role === "user") {
        sendMessage({
          role: "user",
          parts: [{ type: "text", text: convexMessages[0].content || "" }],
        });
      } else if (convexMessages.length > 1) {
        setMessages(
          convexMessages.map((msg) => ({
            id: msg._id,
            role: msg.role as "user" | "assistant",
            content: msg.content || "",
            parts: convertConvexPartsToAISDK(msg.parts || []),
          })),
        );
      }
    }
  }, [convexMessages, setMessages, sendMessage]);

  const handleSubmit = useCallback(
    async (userMessage: string) => {
      try {
        const lastMessage = convexMessages?.[convexMessages.length - 1];

        // Save user message to Convex
        await sendUserMessage({
          conversationId: chatId as Id<"conversations">,
          content: userMessage,
          parts: [{ type: "text", text: userMessage }],
          parentId: lastMessage?._id,
        });

        // Trigger AI response (assistant will be saved in onFinish)
        sendMessage({
          role: "user",
          parts: [{ type: "text", text: userMessage }],
        });
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    },
    [chatId, convexMessages, sendUserMessage, sendMessage],
  );

  useEffect(() => {
    console.log("ChatId changed, resetting state", chatId);
    return () => {
      hasInitialized.current = false;
      hasTriggeredInitialResponse.current = false;
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
      <Input onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
}
