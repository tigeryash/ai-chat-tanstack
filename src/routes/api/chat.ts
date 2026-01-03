import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const lmstudio = createOpenAICompatible({
	name: "lmstudio",
	baseURL: "http://localhost:1234/v1",
});

const model = lmstudio("openai/gpt-oss-20b");

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const { messages }: { messages: UIMessage[] } = await request.json();

				const result = streamText({
					model: model,
					messages: await convertToModelMessages(messages),
				})

				return result.toUIMessageStreamResponse();
			},
		},
	},
});
