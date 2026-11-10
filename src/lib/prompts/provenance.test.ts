import { describe, expect, it } from "vitest";
import { readPromptSource, replyPromptSource } from "./provenance";

describe("prompt provenance", () => {
	it("reads a reply's prompt source", () => {
		expect(
			replyPromptSource({ model: "m", prompt: { promptId: "p", version: 2 } }),
		).toEqual({ promptId: "p", version: 2 });
	});

	it("ignores missing and bad sources (saved chats are untrusted)", () => {
		expect(replyPromptSource({ model: "m" })).toBeUndefined();
		expect(replyPromptSource(undefined)).toBeUndefined();
		expect(replyPromptSource({ prompt: { promptId: "p", version: 0 } })).toBe(
			undefined,
		);
		expect(readPromptSource({ promptId: "", version: 1 })).toBeUndefined();
		expect(readPromptSource("p@1")).toBeUndefined();
	});
});
