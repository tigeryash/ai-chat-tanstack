import type { UIMessage } from "ai";

// A chat with recorded usage (roadmap 2.5), for /e2e/usage and e2e/usage.spec.ts.

const question = (id: string, text: string): UIMessage => ({
	id,
	role: "user",
	parts: [{ type: "text", text }],
});

const answer = (id: string, text: string, metadata: object): UIMessage => ({
	id,
	role: "assistant",
	parts: [{ type: "text", text }],
	metadata,
});

export const USAGE_FIXTURE_MODEL = "deepseek/deepseek-v4.1-flash";

export const USAGE_FIXTURE_MESSAGES: UIMessage[] = [
	question("u1", "First question"),
	answer("a1", "First answer via OpenRouter.", {
		provider: "openrouter",
		model: USAGE_FIXTURE_MODEL,
		gatewayId: USAGE_FIXTURE_MODEL,
		host: "DeepInfra",
		cost: 0.0042,
		usage: { inputTokens: 1200, outputTokens: 340, reasoningTokens: 90 },
		ttftMs: 420,
		tokensPerSecond: 52.4,
	}),
	question("u2", "Second question"),
	answer("a2", "Second answer from Fireworks.", {
		provider: "fireworks",
		model: "accounts/fireworks/models/deepseek-v4p1-flash",
		gatewayId: USAGE_FIXTURE_MODEL,
		cost: 0.0011,
		costEstimated: true,
		usage: { inputTokens: 1600, outputTokens: 200 },
		ttftMs: 1800,
		tokensPerSecond: 120,
	}),
	question("u3", "Third question"),
	answer("a3", "Third answer, run locally.", {
		provider: "local",
		model: "qwen3-8b",
		usage: { inputTokens: 1900, outputTokens: 150 },
		ttftMs: 95,
	}),
];
