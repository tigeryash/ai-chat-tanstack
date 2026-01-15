import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const lmstudio = createOpenAICompatible({
	name: "lmstudio",
	baseURL: process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1",
});

const model = lmstudio("zai-org/glm-4.6v-flash");

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const { messages }: { messages: UIMessage[] } = await request.json();

					console.log("Received messages:", messages);

					const result = streamText({
						model: model,
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
