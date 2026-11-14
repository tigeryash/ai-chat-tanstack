import type { UIMessage } from "ai";
import { describe, expect, it, vi } from "vitest";
import { cleanTitle, writeChatTitle } from "./chat-title-writer";
import { mockChatModel } from "./mock-model";

const messages: UIMessage[] = [
	{
		id: "m1",
		role: "user",
		parts: [{ type: "text", text: "\n  Plan a trip to Lisbon\nin May" }],
	},
];
const choice = { provider: "local", model: "titles" } as const;

describe("chat titles", () => {
	it("are the first line while no title model is set", async () => {
		const resolveModel = vi.fn();
		expect(await writeChatTitle({ messages, choice: null, resolveModel })).toBe(
			"Plan a trip to Lisbon",
		);
		expect(resolveModel).not.toHaveBeenCalled();
	});

	it("are written by the title model from the first message", async () => {
		const resolveModel = vi.fn(async () =>
			mockChatModel({ text: ['"Lisbon ', "trip in May", '."'] }),
		);
		expect(await writeChatTitle({ messages, choice, resolveModel })).toBe(
			"Lisbon trip in May",
		);
		expect(resolveModel).toHaveBeenCalledWith(choice);
	});

	it("fall back to the first line when there's no key", async () => {
		const resolveModel = vi.fn(async () => {
			throw new Error("There's no OpenAI key in this browser.");
		});
		expect(await writeChatTitle({ messages, choice, resolveModel })).toBe(
			"Plan a trip to Lisbon",
		);
	});

	it("fall back to the first line when the request fails or the reply is empty", async () => {
		const failing = mockChatModel({ text: [] });
		failing.doStream = async () => {
			throw new Error("500");
		};
		expect(
			await writeChatTitle({
				messages,
				choice,
				resolveModel: async () => failing,
			}),
		).toBe("Plan a trip to Lisbon");
		expect(
			await writeChatTitle({
				messages,
				choice,
				resolveModel: async () => mockChatModel({ text: ["  \n "] }),
			}),
		).toBe("Plan a trip to Lisbon");
	});

	it("fall back to the first line when the model takes too long", async () => {
		const slow = mockChatModel({ text: ["Too ", "late"], chunkDelayInMs: 200 });
		expect(
			await writeChatTitle({
				messages,
				choice,
				resolveModel: async () => slow,
				timeoutMs: 50,
			}),
		).toBe("Plan a trip to Lisbon");
	});

	it("aren't asked for when the first message has no text", async () => {
		const resolveModel = vi.fn();
		const files: UIMessage[] = [{ id: "m1", role: "user", parts: [] }];
		expect(
			await writeChatTitle({ messages: files, choice, resolveModel }),
		).toBe("");
		expect(resolveModel).not.toHaveBeenCalled();
	});

	it("keep only the title from what the model says", () => {
		expect(cleanTitle("Title: “Budget review”.\nHere's why…")).toBe(
			"Budget review",
		);
		expect(cleanTitle("## **Weekend plans**")).toBe("Weekend plans");
		expect(cleanTitle("x".repeat(200))).toHaveLength(80);
	});
});
