import { describe, expect, it } from "vitest";
import { ChatStoreError } from "./errors";
import v0Chat from "./fixtures/chat-v0.json";
import { CHAT_FORMAT_VERSION, MAX_TITLE_LENGTH, upgradeChat } from "./format";

async function rejection(promise: Promise<unknown>): Promise<ChatStoreError> {
	const error = await promise.then(
		() => {
			throw new Error("expected a rejection");
		},
		(reason: unknown) => reason,
	);
	expect(error).toBeInstanceOf(ChatStoreError);
	return error as ChatStoreError;
}

const currentChat = {
	formatVersion: CHAT_FORMAT_VERSION,
	id: "c1",
	title: "Hello",
	createdAt: 1,
	updatedAt: 2,
	messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] }],
};

describe("upgradeChat", () => {
	it("loads a v0 chat (the old Convex message shape) as AI SDK UI messages", async () => {
		expect(await upgradeChat(v0Chat)).toEqual({
			id: "chat-v0",
			title: "hi",
			createdAt: 1792730874429,
			updatedAt: 1792730931000,
			messages: [
				{
					id: "m1",
					role: "user",
					parts: [{ type: "text", text: "hi", state: "done" }],
				},
				{
					id: "m2",
					role: "assistant",
					parts: [
						{ type: "step-start" },
						{ type: "reasoning", text: "The user greets me.", state: "done" },
						{ type: "text", text: "Hello! How can I help?", state: "done" },
					],
				},
				{
					id: "m3",
					role: "user",
					parts: [
						{
							type: "text",
							text: "what's the weather, and see this",
							state: "done",
						},
						{
							type: "file",
							mediaType: "image/png",
							url: "data:image/png;base64,iVBORw0KGgo=",
						},
						// notes.pdf lived only in Convex storage, so it's dropped.
					],
				},
				{
					id: "m4",
					role: "assistant",
					parts: [
						{
							type: "dynamic-tool",
							toolName: "weather",
							toolCallId: "call-1",
							state: "output-available",
							input: { city: "Toronto" },
							output: { tempC: 4 },
						},
						{
							type: "dynamic-tool",
							toolName: "weather",
							toolCallId: "call-2",
							state: "output-error",
							input: { city: "Atlantis" },
							errorText: "The tool call failed.",
						},
						{
							type: "source-url",
							sourceId: "s1",
							url: "https://example.com/weather",
							title: "Weather",
						},
						{ type: "text", text: "It's 4°C in Toronto.", state: "done" },
					],
				},
				// m5 (role "tool") is dropped; m6 had only `content`; m7 had nothing.
				{
					id: "m6",
					role: "user",
					parts: [{ type: "text", text: "thanks", state: "done" }],
				},
			],
		});
	});

	it("passes a current chat through unchanged", async () => {
		const { formatVersion: _, ...chat } = currentChat;
		expect(await upgradeChat(currentChat)).toEqual(chat);
	});

	it("allows a chat with no messages yet", async () => {
		const chat = await upgradeChat({ ...currentChat, messages: [] });
		expect(chat.messages).toEqual([]);
	});

	it("trims and caps titles", async () => {
		const long = await upgradeChat({
			...currentChat,
			title: `  ${"x".repeat(500)}  `,
		});
		expect(long.title).toBe("x".repeat(MAX_TITLE_LENGTH));
	});

	it("refuses a chat from a newer app version", async () => {
		const error = await rejection(
			upgradeChat({ ...currentChat, formatVersion: CHAT_FORMAT_VERSION + 1 }),
		);
		expect(error.code).toBe("too-new");
		expect(error.chatId).toBe("c1");
	});

	it("rejects invalid messages without quoting their content", async () => {
		const error = await rejection(
			upgradeChat({
				...currentChat,
				messages: [
					{ id: "m1", role: "user", parts: [{ type: "text", text: 42 }] },
					{
						id: "m2",
						role: "user",
						parts: [{ type: "text", text: "secret prompt" }],
					},
				],
			}),
		);
		expect(error.code).toBe("invalid-chat");
		expect(error.issues.length).toBeGreaterThan(0);
		expect(JSON.stringify({ ...error, message: error.message })).not.toContain(
			"secret prompt",
		);
	});

	it("rejects a v0 chat it can't read", async () => {
		const error = await rejection(upgradeChat({ id: "x", messages: "nope" }));
		expect(error.code).toBe("invalid-chat");
	});

	it.each([null, "chat", [], { formatVersion: -1 }, { formatVersion: 1.5 }])(
		"rejects %j",
		async (raw) => {
			expect((await rejection(upgradeChat(raw))).code).toBe("invalid-chat");
		},
	);
});
