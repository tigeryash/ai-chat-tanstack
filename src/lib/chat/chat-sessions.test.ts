import { describe, expect, it, vi } from "vitest";
import {
	type ReplyEnded,
	replyingCount,
	subscribeReplyEnded,
} from "@/lib/background-status/activity";
import { createDexieChatStore } from "@/lib/storage/dexie-chat-store";
import { openTestDatabase } from "@/lib/storage/test-support";
import { BrowserChatTransport } from "./browser-transport";
import {
	deleteChat,
	deleteChats,
	isChatOpen,
	isOpenChatVisibleTo,
	openChat,
	openNewChat,
	openSavedChat,
	setChatOwner,
} from "./chat-sessions";
import { mockChatModel } from "./mock-model";

const SELECTION = { provider: "local", model: "mock" } as const;

describe("chat sessions", () => {
	it("saves the chat to the store when a reply finishes, and reopens it", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		const transport = new BrowserChatTransport(async () =>
			mockChatModel({ reasoning: ["hm"], text: ["Hi ", "there"] }),
		);
		const chat = openNewChat({ transport, store, ownerId: null });
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
		await store.saveMessages(
			"saved-1",
			[{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] }],
			null,
		);

		expect(await openSavedChat("saved-1", null, store)).toBe(true);
		expect(openChat("saved-1").messages).toHaveLength(1);
		expect(await openSavedChat("nope", null, store)).toBe(false);
		expect(isChatOpen("nope")).toBe(false);
	});

	it("treats another account's chat as missing, open or not", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		const hi = [
			{
				id: "m1",
				role: "user" as const,
				parts: [{ type: "text" as const, text: "hi" }],
			},
		];
		await store.saveMessages("a-chat", hi, "user-a");
		await store.saveMessages("shared", hi, null);

		expect(await openSavedChat("a-chat", "user-b", store)).toBe(false);
		expect(await openSavedChat("a-chat", null, store)).toBe(false);
		expect(isChatOpen("a-chat")).toBe(false);
		expect(await openSavedChat("a-chat", "user-a", store)).toBe(true);
		// Open in this tab now, and still hidden from anyone else (after a sign-out, say).
		expect(isOpenChatVisibleTo("a-chat", "user-a")).toBe(true);
		expect(isOpenChatVisibleTo("a-chat", null)).toBe(false);
		expect(await openSavedChat("a-chat", null, store)).toBe(false);
		expect(await openSavedChat("shared", "user-b", store)).toBe(true);
	});

	it("saves a new chat for the account it was opened for, and moves chats between owners", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		const transport = new BrowserChatTransport(async () =>
			mockChatModel({ text: ["ok"] }),
		);
		const chat = openNewChat({ transport, store, ownerId: "user-a" });
		await chat.sendMessage({ text: "hi" }, { body: SELECTION });
		await vi.waitFor(async () =>
			expect(await store.getChat(chat.id)).toMatchObject({ ownerId: "user-a" }),
		);

		await setChatOwner([chat.id], null, store);
		expect(await store.getChat(chat.id)).toMatchObject({ ownerId: null });
		expect(isOpenChatVisibleTo(chat.id, "user-b")).toBe(true);

		await deleteChats([chat.id], store);
		expect(isChatOpen(chat.id)).toBe(false);
		expect(await store.getChat(chat.id)).toBeUndefined();
	});

	it("names a new chat after its first message", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		const transport = new BrowserChatTransport(async () =>
			mockChatModel({ text: ["ok"] }),
		);
		const chat = openNewChat({ transport, store, ownerId: null });

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
		await store.saveMessages(
			"busy",
			[{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] }],
			null,
		);
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

	it("reports replies running and ending to the tab status", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		const ended: ReplyEnded[] = [];
		const stop = subscribeReplyEnded((event) => ended.push(event));
		const transport = new BrowserChatTransport(async () =>
			mockChatModel({ text: ["a", "b"], chunkDelayInMs: 20 }),
		);
		const chat = openNewChat({ transport, store, ownerId: null });

		const reply = chat.sendMessage({ text: "hi" }, { body: SELECTION });
		await vi.waitFor(() => expect(replyingCount()).toBe(1));
		await reply;
		expect(replyingCount()).toBe(0);
		await vi.waitFor(() =>
			expect(ended).toEqual([{ chatId: chat.id, outcome: "finished" }]),
		);

		const failing = openNewChat({
			store,
			ownerId: null,
			transport: new BrowserChatTransport(async () => {
				throw new Error("no model");
			}),
		});
		await failing.sendMessage({ text: "hi" }, { body: SELECTION });
		expect(ended).toContainEqual({ chatId: failing.id, outcome: "failed" });
		expect(replyingCount()).toBe(0);
		stop();
	});
});
