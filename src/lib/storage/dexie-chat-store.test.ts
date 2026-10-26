import { describe, expect, it } from "vitest";
import { createDexieChatStore } from "./dexie-chat-store";
import { ChatStoreError } from "./errors";
import v0Chat from "./fixtures/chat-v0.json";
import { CHAT_FORMAT_VERSION } from "./format";
import { openTestDatabase, textMessage, tickingClock } from "./test-support";

function setup() {
	const db = openTestDatabase();
	return { db, store: createDexieChatStore({ db, now: tickingClock() }) };
}

const hello = [
	textMessage("m1", "user", "hello"),
	textMessage("m2", "assistant", "hi there"),
];

describe("DexieChatStore", () => {
	it("creates a chat on first save and reads it back", async () => {
		const { store } = setup();

		expect(await store.saveMessages("c1", hello)).toEqual({ created: true });
		expect(await store.getChat("c1")).toEqual({
			id: "c1",
			title: "",
			createdAt: 1000,
			updatedAt: 1000,
			messages: hello,
		});
	});

	it("replaces the messages on later saves and keeps createdAt", async () => {
		const { store } = setup();
		await store.saveMessages("c1", hello);
		const shorter = [textMessage("m1", "user", "edited")];

		expect(await store.saveMessages("c1", shorter)).toEqual({ created: false });
		expect(await store.getChat("c1")).toMatchObject({
			createdAt: 1000,
			updatedAt: 1001,
			messages: shorter,
		});
	});

	it("lists chats newest first, without loading messages", async () => {
		const { store } = setup();
		await store.saveMessages("old", hello);
		await store.saveMessages("new", hello.slice(0, 1));

		expect(await store.listChats()).toEqual([
			{
				id: "new",
				title: "",
				createdAt: 1001,
				updatedAt: 1001,
				messageCount: 1,
			},
			{
				id: "old",
				title: "",
				createdAt: 1000,
				updatedAt: 1000,
				messageCount: 2,
			},
		]);
	});

	it("renames without reordering", async () => {
		const { store } = setup();
		await store.saveMessages("c1", hello);
		await store.renameChat("c1", "  Greetings  ");

		expect(await store.getChat("c1")).toMatchObject({
			title: "Greetings",
			updatedAt: 1000,
		});
	});

	it("refuses to rename a chat that doesn't exist", async () => {
		const { store } = setup();
		await expect(store.renameChat("nope", "x")).rejects.toMatchObject({
			code: "not-found",
		});
	});

	it("deletes a chat and its messages", async () => {
		const { db, store } = setup();
		await store.saveMessages("c1", hello);
		await store.saveMessages("c2", hello);
		await store.deleteChat("c1");
		await store.deleteChat("never-existed");

		expect(await store.getChat("c1")).toBeUndefined();
		expect((await store.listChats()).map((chat) => chat.id)).toEqual(["c2"]);
		expect(await db.messages.count()).toBe(2);
	});

	it("rejects invalid messages and bad IDs without writing", async () => {
		const { store } = setup();
		const bad = [{ id: "m1", role: "robot", parts: [] }] as never;

		await expect(store.saveMessages("c1", bad)).rejects.toBeInstanceOf(
			ChatStoreError,
		);
		await expect(store.saveMessages("", hello)).rejects.toMatchObject({
			code: "invalid-chat",
		});
		expect(await store.listChats()).toEqual([]);
	});

	it("migrates an old chat when it loads", async () => {
		const { db, store } = setup();
		const { messages, ...row } = v0Chat;
		await db.chats.put({
			...row,
			messageCount: messages.length,
			formatVersion: 0,
		});
		await db.messages.bulkPut(
			messages.map((message, position) => ({
				chatId: row.id,
				position,
				message,
			})),
		);

		const chat = await store.getChat("chat-v0");
		expect(chat?.messages[0]).toEqual({
			id: "m1",
			role: "user",
			parts: [{ type: "text", text: "hi", state: "done" }],
		});

		// Saving writes the current format.
		await store.saveMessages("chat-v0", chat?.messages ?? []);
		expect((await db.chats.get("chat-v0"))?.formatVersion).toBe(
			CHAT_FORMAT_VERSION,
		);
	});

	it("won't overwrite a chat saved by a newer app version", async () => {
		const { db, store } = setup();
		await db.chats.put({
			id: "future",
			title: "",
			createdAt: 1,
			updatedAt: 1,
			messageCount: 0,
			formatVersion: CHAT_FORMAT_VERSION + 1,
		});

		await expect(store.getChat("future")).rejects.toMatchObject({
			code: "too-new",
		});
		await expect(store.saveMessages("future", hello)).rejects.toMatchObject({
			code: "too-new",
		});
	});

	it("puts whole chats with their own timestamps", async () => {
		const { store } = setup();
		const chat = {
			id: "c1",
			title: "T",
			createdAt: 5,
			updatedAt: 9,
			messages: hello,
		};
		await store.saveMessages("c1", hello.slice(0, 1));
		await store.putChats([chat]);

		expect(await store.getChat("c1")).toEqual(chat);
	});

	it("keeps data across database connections", async () => {
		const { db, store } = setup();
		await store.saveMessages("c1", hello);
		db.close();
		await db.open();

		expect(
			(await createDexieChatStore({ db }).getChat("c1"))?.messages,
		).toEqual(hello);
	});
});
