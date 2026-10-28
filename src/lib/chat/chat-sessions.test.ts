import { describe, expect, it, vi } from "vitest";
import { createDexieChatStore } from "@/lib/storage/dexie-chat-store";
import { openTestDatabase } from "@/lib/storage/test-support";
import { BrowserChatTransport } from "./browser-transport";
import {
	deleteChat,
	isChatOpen,
	openChat,
	openNewChat,
	openSavedChat,
} from "./chat-sessions";
import { mockChatModel } from "./mock-model";

const SELECTION = { provider: "local", model: "mock" } as const;

describe("chat sessions", () => {
	it("saves the chat to the store when a reply finishes, and reopens it", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		const transport = new BrowserChatTransport(async () =>
			mockChatModel({ reasoning: ["hm"], text: ["Hi ", "there"] }),
		);
		const chat = openNewChat({ transport, store });
		expect(await store.getChat(chat.id)).toBeUndefined();

		await chat.sendMessage({ text: "hello" }, { body: SELECTION });

		// onFinish saves without the SDK waiting for it.
		const saved = await vi.waitFor(async () => {
			const found = await store.getChat(chat.id);
			if (!found) throw new Error("not saved yet");
			return found;
		});
		expect(saved.messages.map((message) => message.role)).toEqual([
			"user",
			"assistant",
		]);
		expect(saved.messages[1].parts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "reasoning", text: "hm" }),
				expect.objectContaining({ type: "text", text: "Hi there" }),
			]),
		);
		expect(saved.messages[1].metadata).toEqual(SELECTION);
		expect(openChat(chat.id)).toBe(chat);
	});

	it("opens a saved chat with its messages, and reports a missing one", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		await store.saveMessages("saved-1", [
			{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] },
		]);

		expect(await openSavedChat("saved-1", store)).toBe(true);
		expect(openChat("saved-1").messages).toHaveLength(1);
		expect(await openSavedChat("nope", store)).toBe(false);
		expect(isChatOpen("nope")).toBe(false);
	});

	it("names a new chat after its first message", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		const transport = new BrowserChatTransport(async () =>
			mockChatModel({ text: ["ok"] }),
		);
		const chat = openNewChat({ transport, store });

		await chat.sendMessage(
			{ text: "Plan a trip\nto Lisbon" },
			{ body: SELECTION },
		);

		await vi.waitFor(async () =>
			expect(await store.getChat(chat.id)).toMatchObject({
				title: "Plan a trip",
			}),
		);
	});

	it("deletes a chat mid-reply without the stopped reply saving it again", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		await store.saveMessages("busy", [
			{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] },
		]);
		const transport = new BrowserChatTransport(async () =>
			mockChatModel({ text: ["a", "b", "c"], chunkDelayInMs: 50 }),
		);
		const chat = openChat("busy", { transport, store });
		const reply = chat.sendMessage({ text: "more" }, { body: SELECTION });
		await vi.waitFor(() => expect(chat.status).toBe("streaming"));

		await deleteChat("busy", store);
		await reply;
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(isChatOpen("busy")).toBe(false);
		expect(await store.getChat("busy")).toBeUndefined();
	});
});
