import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
	CONTEXT_NEARING_RATIO,
	contextLevel,
	contextTokens,
} from "./context-usage";

const user = (id: string): UIMessage => ({
	id,
	role: "user",
	parts: [{ type: "text", text: "hi" }],
});
const reply = (id: string, metadata: unknown): UIMessage => ({
	id,
	role: "assistant",
	parts: [{ type: "text", text: "hello" }],
	metadata,
});

describe("contextTokens", () => {
	it("is the latest reply's input plus output, not the chat's running total", () => {
		const messages = [
			user("u1"),
			reply("a1", { usage: { inputTokens: 100, outputTokens: 50 } }),
			user("u2"),
			reply("a2", { usage: { inputTokens: 300, outputTokens: 20 } }),
		];
		expect(contextTokens(messages)).toBe(320);
	});

	it("skips replies without token counts", () => {
		const messages = [
			reply("a1", { usage: { inputTokens: 100, outputTokens: 50 } }),
			user("u2"),
			reply("a2", { ttftMs: 120 }),
		];
		expect(contextTokens(messages)).toBe(150);
	});

	it("is null with no recorded usage, or with bad saved metadata", () => {
		expect(contextTokens([])).toBeNull();
		expect(contextTokens([user("u1")])).toBeNull();
		expect(
			contextTokens([reply("a1", { usage: { inputTokens: "lots" } })]),
		).toBeNull();
	});
});

describe("contextLevel", () => {
	const length = 10_000;

	it("is under below the nearing threshold", () => {
		expect(contextLevel(0, length)).toBe("under");
		expect(contextLevel(length * CONTEXT_NEARING_RATIO - 1, length)).toBe(
			"under",
		);
	});

	it("is nearing from 80% up to the limit", () => {
		expect(CONTEXT_NEARING_RATIO).toBe(0.8);
		expect(contextLevel(8_000, length)).toBe("nearing");
		expect(contextLevel(9_999, length)).toBe("nearing");
	});

	it("is over at or past the limit", () => {
		expect(contextLevel(10_000, length)).toBe("over");
		expect(contextLevel(25_000, length)).toBe("over");
	});

	it("is null when the context length or the tokens are unknown", () => {
		expect(contextLevel(9_000, undefined)).toBeNull();
		expect(contextLevel(9_000, 0)).toBeNull();
		expect(contextLevel(null, length)).toBeNull();
	});
});
