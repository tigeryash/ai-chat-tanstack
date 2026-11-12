import type { UIMessage } from "ai";

// Saved chats on DeepSeek V4.1 Flash (128K context in the seeded catalog) at about 41%, 85% and 110% of
// it (roadmap R2 S4), for e2e/context-warning.spec.ts. The model comes from the reply's metadata, as in
// a chat saved by the app.

export const CONTEXT_FIXTURE_MODEL = "deepseek/deepseek-v4.1-flash";

const chatOf = (inputTokens: number, outputTokens: number): UIMessage[] => [
	{
		id: "u1",
		role: "user",
		parts: [{ type: "text", text: "A long question" }],
	},
	{
		id: "a1",
		role: "assistant",
		parts: [{ type: "text", text: "A long answer" }],
		metadata: {
			provider: "openrouter",
			model: CONTEXT_FIXTURE_MODEL,
			gatewayId: CONTEXT_FIXTURE_MODEL,
			usage: { inputTokens, outputTokens },
		},
	},
];

export const CONTEXT_FIXTURE_CHATS = {
	under: chatOf(51_000, 1_600),
	nearing: chatOf(108_000, 1_500),
	over: chatOf(137_000, 3_800),
} as const;
