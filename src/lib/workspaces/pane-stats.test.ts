import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { paneStats, samePaneStats } from "./pane-stats";

const reply = (id: string, metadata: unknown): UIMessage => ({
	id,
	role: "assistant",
	parts: [{ type: "text", text: "…" }],
	metadata,
});
const question = (id: string): UIMessage => ({
	id,
	role: "user",
	parts: [{ type: "text", text: "?" }],
	metadata: { ttftMs: 1 },
});

describe("paneStats", () => {
	it("is null before any reply recorded stats (or for replies saved before 2.5)", () => {
		expect(paneStats([])).toBeNull();
		expect(
			paneStats([question("q"), reply("a", { provider: "local" })]),
		).toBeNull();
	});

	it("shows the latest reply's timing, averages over the timed replies, and the chat's cost", () => {
		const stats = paneStats([
			question("q1"),
			reply("a", {
				provider: "openrouter",
				model: "m",
				cost: 0.002,
				usage: { inputTokens: 10, outputTokens: 20 },
				ttftMs: 400,
				tokensPerSecond: 50,
			}),
			question("q2"),
			reply("b", {
				provider: "openrouter",
				model: "m",
				cost: 0.004,
				costEstimated: true,
				usage: { inputTokens: 10, outputTokens: 20 },
				ttftMs: 200,
				tokensPerSecond: 100,
			}),
			// A stopped reply records only its TTFT.
			reply("c", { provider: "openrouter", model: "m", ttftMs: 600 }),
		]);
		expect(stats).toMatchObject({
			last: { ttftMs: 600 },
			avgTtftMs: 400,
			avgTokensPerSecond: 75,
			timedReplies: 3,
		});
		expect(stats?.last.tokensPerSecond).toBeUndefined();
		expect(stats?.usage?.total).toMatchObject({
			cost: 0.006,
			costEstimated: true,
		});
	});

	it("ignores bad saved numbers (saved chats are untrusted)", () => {
		const stats = paneStats([
			reply("a", { provider: "local", ttftMs: -5, tokensPerSecond: 30 }),
		]);
		expect(stats).toMatchObject({
			last: { tokensPerSecond: 30 },
			timedReplies: 1,
		});
		expect(stats?.last.ttftMs).toBeUndefined();
		expect(stats?.avgTtftMs).toBeUndefined();
	});

	it("compares by value", () => {
		const messages = [reply("a", { provider: "local", ttftMs: 10 })];
		expect(samePaneStats(paneStats(messages), paneStats(messages))).toBe(true);
		expect(
			samePaneStats(
				paneStats(messages),
				paneStats([reply("a", { provider: "local", ttftMs: 11 })]),
			),
		).toBe(false);
	});
});
