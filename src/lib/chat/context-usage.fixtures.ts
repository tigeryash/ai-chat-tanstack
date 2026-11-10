import type { UIMessage } from "ai";

// Chats near and past a 128K context (roadmap R2 S4), for /e2e/context-warning and
// e2e/context-warning.spec.ts.

export const CONTEXT_FIXTURE_LENGTH = 128_000;

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
			model: "deepseek/deepseek-v4.1-flash",
			usage: { inputTokens, outputTokens },
		},
	},
];

export const CONTEXT_FIXTURE_CHATS = {
	under: chatOf(40_000, 2_000),
	nearing: chatOf(108_000, 1_500),
	over: chatOf(127_500, 4_000),
} as const;
