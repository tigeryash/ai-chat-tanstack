import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { chatUsage, sameChatUsage } from "./chat-usage";

const reply = (id: string, metadata: unknown): UIMessage => ({
	id,
	role: "assistant",
	parts: [{ type: "text", text: "…" }],
	metadata,
});
const question: UIMessage = {
	id: "q",
	role: "user",
	parts: [{ type: "text", text: "?" }],
	metadata: { usage: { inputTokens: 999 } },
};

describe("chatUsage", () => {
	it("adds up tokens and cost overall and per provider, priciest first", () => {
		const usage = chatUsage([
			question,
			reply("a", {
				provider: "openrouter",
				model: "m",
				host: "DeepInfra",
				cost: 0.002,
				usage: { inputTokens: 100, outputTokens: 50 },
			}),
			reply("b", {
				provider: "local",
				model: "qwen",
				usage: { inputTokens: 200, outputTokens: 80 },
			}),
			reply("c", {
				provider: "openrouter",
				model: "m",
				cost: 0.003,
				costEstimated: true,
				usage: { inputTokens: 300, outputTokens: 60 },
			}),
		]);
		expect(usage?.total).toEqual({
			replies: 3,
			inputTokens: 600,
			outputTokens: 190,
			cost: 0.005,
			costEstimated: true,
			unpriced: 1,
		});
		expect(usage?.byProvider.map((p) => [p.name, p.replies, p.cost])).toEqual([
			["OpenRouter", 2, 0.005],
			["Local", 1, 0],
		]);
		expect(usage?.byProvider[1]?.unpriced).toBe(1);
	});

	it("counts a cost without tokens, and skips old or unknown replies", () => {
		const usage = chatUsage([
			reply("a", { provider: "openrouter", model: "m", cost: 0.01 }),
			reply("b", { provider: "openrouter", model: "m" }),
			reply("c", { provider: "nope", model: "m", cost: 1 }),
			reply("d", { provider: "openai", model: "m", cost: -1 }),
			reply("e", undefined),
		]);
		expect(usage?.total).toMatchObject({ replies: 1, cost: 0.01 });
		expect(chatUsage([question, reply("x", undefined)])).toBeNull();
	});

	it("compares totals by value", () => {
		const make = () =>
			chatUsage([
				reply("a", {
					provider: "local",
					model: "q",
					usage: { outputTokens: 3 },
				}),
			]);
		expect(sameChatUsage(make(), make())).toBe(true);
		expect(sameChatUsage(make(), null)).toBe(false);
	});
});
