import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getToken } from "@/lib/auth-server";
import { logError } from "@/lib/log";
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
					// Name only: AI SDK errors can carry the request body (the user's messages), which
					// never goes in logs (hard rule 4), and details stay out of the response.
					logError(
						"Chat API error:",
						error instanceof Error ? error.name : "unknown error",
					);
					return new Response(
						JSON.stringify({ error: "The chat request failed." }),
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
