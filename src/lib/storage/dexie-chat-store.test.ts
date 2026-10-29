import Dexie from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { openChatDatabase } from "./db";
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

		expect(await store.saveMessages("c1", hello, null)).toEqual({
			created: true,
		});
		expect(await store.getChat("c1")).toEqual({
			id: "c1",
			title: "",
			createdAt: 1000,
			updatedAt: 1000,
			ownerId: null,
			messages: hello,
		});
	});

	it("replaces the messages on later saves and keeps createdAt", async () => {
		const { store } = setup();
		await store.saveMessages("c1", hello, null);
		const shorter = [textMessage("m1", "user", "edited")];

		expect(await store.saveMessages("c1", shorter, null)).toEqual({
			created: false,
		});
		expect(await store.getChat("c1")).toMatchObject({
			createdAt: 1000,
			updatedAt: 1001,
			messages: shorter,
		});
	});

	it("lists chats newest first, without loading messages", async () => {
		const { store } = setup();
		await store.saveMessages("old", hello, null);
		await store.saveMessages("new", hello.slice(0, 1), null);

		expect(await store.listChats()).toEqual([
			{
				id: "new",
				title: "",
				createdAt: 1001,
				updatedAt: 1001,
				messageCount: 1,
				pinned: false,
				ownerId: null,
			},
			{
				id: "old",
				title: "",
				createdAt: 1000,
				updatedAt: 1000,
				messageCount: 2,
				pinned: false,
				ownerId: null,
			},
		]);
	});

	it("renames without reordering", async () => {
		const { store } = setup();
		await store.saveMessages("c1", hello, null);
		await store.renameChat("c1", "  Greetings  ");

		expect(await store.getChat("c1")).toMatchObject({
			title: "Greetings",
			updatedAt: 1000,
		});
	});

	it("pins without reordering, and keeps the pin when the chat saves again", async () => {
		const { store } = setup();
		await store.saveMessages("c1", hello, null);
		await store.setPinned("c1", true);

		expect(await store.listChats()).toEqual([
			expect.objectContaining({ id: "c1", pinned: true, updatedAt: 1000 }),
		]);
		await store.saveMessages("c1", hello, null);
		expect(await store.getChat("c1")).toMatchObject({ pinned: true });

		await store.setPinned("c1", false);
		expect(await store.listChats()).toEqual([
			expect.objectContaining({ id: "c1", pinned: false }),
		]);
		await expect(store.setPinned("nope", true)).rejects.toMatchObject({
			code: "not-found",
		});
	});

	it("tells watchers about every change until they stop watching", async () => {
		// liveQuery stays idle without a global IndexedDB, which Node doesn't have.
		Dexie.dependencies.indexedDB ??= new IDBFactory();
		const { store } = setup();
		const seen: string[][] = [];
		const stop = store.watchChats(
			(chats) => seen.push(chats.map((chat) => `${chat.id}:${chat.title}`)),
			(error) => {
				throw error;
			},
		);
		await vi.waitFor(() => expect(seen).toEqual([[]]));

		await store.saveMessages("c1", hello, null);
		await vi.waitFor(() => expect(seen.at(-1)).toEqual(["c1:"]));
		await store.renameChat("c1", "Hi");
		await vi.waitFor(() => expect(seen.at(-1)).toEqual(["c1:Hi"]));

		stop();
		const count = seen.length;
		await store.deleteChat("c1");
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(seen).toHaveLength(count);
	});

	it("refuses to rename a chat that doesn't exist", async () => {
		const { store } = setup();
		await expect(store.renameChat("nope", "x")).rejects.toMatchObject({
			code: "not-found",
		});
	});

	it("deletes a chat and its messages", async () => {
		const { db, store } = setup();
		await store.saveMessages("c1", hello, null);
		await store.saveMessages("c2", hello, null);
		await store.deleteChat("c1");
		await store.deleteChat("never-existed");

		expect(await store.getChat("c1")).toBeUndefined();
		expect((await store.listChats()).map((chat) => chat.id)).toEqual(["c2"]);
		expect(await db.messages.count()).toBe(2);
	});

	it("rejects invalid messages and bad IDs without writing", async () => {
		const { store } = setup();
		const bad = [{ id: "m1", role: "robot", parts: [] }] as never;

		await expect(store.saveMessages("c1", bad, null)).rejects.toBeInstanceOf(
			ChatStoreError,
		);
		await expect(store.saveMessages("", hello, null)).rejects.toMatchObject({
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
		await store.saveMessages("chat-v0", chat?.messages ?? [], null);
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
		await expect(
			store.saveMessages("future", hello, null),
		).rejects.toMatchObject({
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
			ownerId: "user-a",
			messages: hello,
		};
		await store.saveMessages("c1", hello.slice(0, 1), null);
		await store.putChats([chat]);

		expect(await store.getChat("c1")).toEqual(chat);
	});

	it("gives a new chat its owner, and keeps the owner on later saves", async () => {
		const { store } = setup();
		await store.saveMessages("mine", hello, "user-a");
		await store.saveMessages("mine", hello.slice(0, 1), "user-b");
		await store.saveMessages("anyone", hello, null);

		expect(await store.getChat("mine")).toMatchObject({ ownerId: "user-a" });
		expect(
			(await store.listChats()).map(({ id, ownerId }) => ({ id, ownerId })),
		).toEqual([
			{ id: "anyone", ownerId: null },
			{ id: "mine", ownerId: "user-a" },
		]);
	});

	it("moves chats to another owner without reordering, skipping missing ones", async () => {
		const { store } = setup();
		await store.saveMessages("c1", hello, null);
		await store.saveMessages("c2", hello, null);
		await store.setOwner(["c1", "never-existed"], "user-a");

		expect(await store.listChats()).toEqual([
			expect.objectContaining({ id: "c2", ownerId: null }),
			expect.objectContaining({ id: "c1", ownerId: "user-a", updatedAt: 1000 }),
		]);
		expect(await store.getChat("c1")).toMatchObject({ ownerId: "user-a" });

		await store.setOwner(["c1"], null);
		expect(await store.getChat("c1")).toMatchObject({ ownerId: null });
		await expect(store.setOwner(["c1"], "")).rejects.toMatchObject({
			code: "invalid-chat",
		});
		await expect(store.saveMessages("c3", hello, "")).rejects.toMatchObject({
			code: "invalid-chat",
		});
	});

	it("upgrades format 1 rows to no-account chats when the database opens", async () => {
		// The database as roadmap 1.3 left it: Dexie version 1, format 1 rows without an owner.
		const indexedDB = new IDBFactory();
		const old = new Dexie("upgrade-test", { indexedDB, IDBKeyRange });
		old.version(1).stores({
			chats: "id, updatedAt",
			messages: "[chatId+position]",
		});
		await old.table("chats").put({
			id: "c1",
			title: "Old",
			createdAt: 1,
			updatedAt: 2,
			messageCount: 1,
			pinned: true,
			formatVersion: 1,
		});
		await old
			.table("messages")
			.put({ chatId: "c1", position: 0, message: hello[0] });
		old.close();

		const db = openChatDatabase("upgrade-test", { indexedDB, IDBKeyRange });
		const store = createDexieChatStore({ db });
		expect(await db.chats.get("c1")).toMatchObject({
			formatVersion: CHAT_FORMAT_VERSION,
			ownerId: null,
		});
		expect(await store.listChats()).toEqual([
			expect.objectContaining({ id: "c1", ownerId: null, pinned: true }),
		]);
		expect(await store.getChat("c1")).toMatchObject({
			title: "Old",
			ownerId: null,
			messages: [hello[0]],
		});
	});

	it("keeps data across database connections", async () => {
		const { db, store } = setup();
		await store.saveMessages("c1", hello, null);
		db.close();
		await db.open();

		expect(
			(await createDexieChatStore({ db }).getChat("c1"))?.messages,
		).toEqual(hello);
	});
});
