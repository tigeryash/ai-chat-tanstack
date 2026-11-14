import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { lastReply, replyText } from "./reply-text";

const reply: UIMessage = {
	id: "r",
	role: "assistant",
	parts: [
		{ type: "reasoning", text: "thinking" },
		{ type: "text", text: "One" },
		{ type: "text", text: "Two" },
	],
};
const ask: UIMessage = {
	id: "u",
	role: "user",
	parts: [{ type: "text", text: "Hi" }],
};

describe("replyText", () => {
	it("joins only the text parts", () => {
		expect(replyText(reply)).toBe("One\n\nTwo");
	});
});

describe("lastReply", () => {
	it("is the last message only when it's a reply", () => {
		expect(lastReply([ask, reply])).toBe(reply);
		expect(lastReply([reply, ask])).toBeUndefined();
		expect(lastReply([])).toBeUndefined();
	});
});
