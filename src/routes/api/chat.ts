import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getToken } from "@/lib/auth-server";
import { createThinkTagModel } from "@/lib/reasoning-middleware";
import { getServerChatConfig } from "@/utilities/chat-config";

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const token = await getToken();
					if (!token) {
						return new Response(JSON.stringify({ error: "Unauthorized" }), {
							status: 401,
							headers: { "Content-Type": "application/json" },
						});
					}

					const chatConfig = getServerChatConfig();
					const { messages }: { messages: UIMessage[] } = await request.json();

					console.log("Received messages:", messages);

					const provider = createOpenAICompatible({
						name: chatConfig.provider,
						baseURL: chatConfig.baseUrl,
					});

					const result = streamText({
						model: createThinkTagModel(provider(chatConfig.model)),
						messages: await convertToModelMessages(messages),
					});

					return result.toUIMessageStreamResponse();
				} catch (error) {
					console.error("Chat API error:", error);
					return new Response(
						JSON.stringify({
							error: error instanceof Error ? error.message : "Unknown error",
						}),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			},
		},
	},
});
