import { describe, expect, it } from "vitest";
import type { Chat, ChatStore } from "./chat-store";
import { createDexieChatStore } from "./dexie-chat-store";
import { ChatStoreError } from "./errors";
import { CHAT_EXPORT_FORMAT, exportChats, importChats } from "./export";
import v0Chat from "./fixtures/chat-v0.json";
import { CHAT_FORMAT_VERSION } from "./format";
import { openTestDatabase, textMessage, tickingClock } from "./test-support";

function freshStore(name = "chats") {
	return createDexieChatStore({
		db: openTestDatabase(name),
		now: tickingClock(),
	});
}

async function everything(store: ChatStore): Promise<Chat[]> {
	const chats = await Promise.all(
		(await store.listChats()).map((summary) => store.getChat(summary.id)),
	);
	return chats.filter((chat) => chat !== undefined);
}

function exportFile(chats: unknown[], exportVersion = 1) {
	return JSON.stringify({ format: CHAT_EXPORT_FORMAT, exportVersion, chats });
}

describe("export and import", () => {
	it("export → wipe → import restores everything", async () => {
		const store = freshStore();
		await store.saveMessages(
			"c1",
			[
				textMessage("m1", "user", "hello"),
				textMessage("m2", "assistant", "hi"),
			],
			null,
		);
		await store.saveMessages(
			"c2",
			[textMessage("m3", "user", "second chat")],
			null,
		);
		await store.renameChat("c2", "Second");
		await store.setSettings("c2", {
			params: { temperature: 0.5 },
			systemPrompt: "Be brief.",
		});
		const before = await everything(store);
		expect(before.find((chat) => chat.id === "c2")?.settings).toBeDefined();

		const exported = await exportChats(store, null);
		expect(exported).toMatchObject({ chatCount: 2, unreadableChatIds: [] });

		// A different, empty database stands in for a wiped browser.
		const wiped = freshStore("after-wipe");
		expect(await wiped.listChats()).toEqual([]);

		expect(await importChats(wiped, exported.json, null)).toEqual({
			imported: 2,
			skipped: 0,
			otherAccounts: 0,
		});
		expect(await everything(wiped)).toEqual(before);
	});

	it("writes the file and chat format versions", async () => {
		const store = freshStore();
		await store.saveMessages("c1", [textMessage("m1", "user", "hello")], null);
		const file = JSON.parse((await exportChats(store, null, () => 0)).json);

		expect(file).toMatchObject({
			format: CHAT_EXPORT_FORMAT,
			exportVersion: 1,
			exportedAt: "1970-01-01T00:00:00.000Z",
			chats: [{ formatVersion: CHAT_FORMAT_VERSION, id: "c1", ownerId: null }],
		});
	});

	it("copies only chat fields, so nothing else stored with a chat leaks out", async () => {
		const leaky: ChatStore = {
			...freshStore(),
			listChats: async () => [
				{
					id: "c1",
					title: "",
					createdAt: 1,
					updatedAt: 1,
					messageCount: 0,
					pinned: false,
					ownerId: null,
				},
			],
			getChat: async () =>
				({
					id: "c1",
					title: "",
					createdAt: 1,
					updatedAt: 1,
					ownerId: null,
					messages: [],
					apiKey: "sk-test-not-a-real-key",
				}) as Chat,
		};
		const { json } = await exportChats(leaky, null);
		expect(json).not.toContain("apiKey");
		expect(json).not.toContain("sk-test");
	});

	it("leaves out chats that can't be read and says which", async () => {
		const db = openTestDatabase();
		const store = createDexieChatStore({ db });
		await store.saveMessages(
			"good",
			[textMessage("m1", "user", "hello")],
			null,
		);
		await db.chats.put({
			id: "future",
			title: "",
			createdAt: 1,
			updatedAt: 1,
			messageCount: 0,
			formatVersion: 99,
		});

		expect(await exportChats(store, null)).toMatchObject({
			chatCount: 1,
			unreadableChatIds: ["future"],
		});
	});

	it("migrates old chats in the file", async () => {
		const store = freshStore();
		await importChats(store, exportFile([v0Chat]), null);
		expect((await store.getChat("chat-v0"))?.messages).toHaveLength(5);
	});

	it("keeps the newer copy when a chat is already on this device", async () => {
		const store = freshStore();
		const chat = (updatedAt: number, text: string) => ({
			formatVersion: 1,
			id: "c1",
			title: "",
			createdAt: 1,
			updatedAt,
			messages: [textMessage("m1", "user", text)],
		});
		await importChats(store, exportFile([chat(10, "local")]), null);

		expect(
			await importChats(store, exportFile([chat(5, "older")]), null),
		).toEqual({ imported: 0, skipped: 1, otherAccounts: 0 });
		expect(
			await importChats(store, exportFile([chat(20, "newer")]), null),
		).toEqual({ imported: 1, skipped: 0, otherAccounts: 0 });
		expect((await store.getChat("c1"))?.messages[0].parts[0]).toMatchObject({
			text: "newer",
		});
	});

	it("exports only the chats the viewer can see, with their owners", async () => {
		const store = freshStore();
		const hello = [textMessage("m1", "user", "hello")];
		await store.saveMessages("anyone", hello, null);
		await store.saveMessages("a", hello, "user-a");
		await store.saveMessages("b", hello, "user-b");

		const owners = async (viewer: string | null) =>
			(JSON.parse((await exportChats(store, viewer)).json).chats as Chat[])
				.map((chat) => `${chat.id}:${chat.ownerId}`)
				.sort();
		expect(await owners("user-a")).toEqual(["a:user-a", "anyone:null"]);
		expect(await owners(null)).toEqual(["anyone:null"]);
	});

	it("imports chats with the owners in the file, never the signed-in account", async () => {
		const store = freshStore();
		const chat = (id: string, ownerId: string | null) => ({
			formatVersion: CHAT_FORMAT_VERSION,
			id,
			title: "",
			createdAt: 1,
			updatedAt: 1,
			ownerId,
			messages: [textMessage("m1", "user", "hi")],
		});
		const file = exportFile([
			chat("anyone", null),
			chat("a", "user-a"),
			chat("b", "user-b"),
		]);

		expect(await importChats(store, file, "user-a")).toEqual({
			imported: 3,
			skipped: 0,
			otherAccounts: 1,
		});
		expect(
			(await store.listChats()).map((c) => `${c.id}:${c.ownerId}`).sort(),
		).toEqual(["a:user-a", "anyone:null", "b:user-b"]);
	});

	it("keeps the owner on this device when a newer copy is imported", async () => {
		const store = freshStore();
		const hello = [textMessage("m1", "user", "hello")];
		await store.saveMessages("mine", hello, "user-a");
		await store.saveMessages("anyone", hello, null);
		const newer = (id: string) => ({
			formatVersion: CHAT_FORMAT_VERSION,
			id,
			title: "",
			createdAt: 1,
			updatedAt: 1_000_000,
			ownerId: "user-b",
			messages: [textMessage("m1", "user", "newer")],
		});

		expect(
			await importChats(
				store,
				exportFile([newer("mine"), newer("anyone")]),
				"user-a",
			),
		).toEqual({ imported: 2, skipped: 0, otherAccounts: 0 });
		expect(await store.getChat("mine")).toMatchObject({ ownerId: "user-a" });
		expect(await store.getChat("anyone")).toMatchObject({ ownerId: null });
	});

	it("writes nothing if any chat in the file is invalid", async () => {
		const store = freshStore();
		const file = exportFile([v0Chat, { formatVersion: 1, id: "bad" }]);

		await expect(importChats(store, file, null)).rejects.toMatchObject({
			code: "invalid-chat",
			chatId: "bad",
		});
		expect(await store.listChats()).toEqual([]);
	});

	it.each([
		["not JSON", "{", "invalid-export"],
		[
			"another app's file",
			JSON.stringify({ format: "other", chats: [] }),
			"invalid-export",
		],
		["a newer export layout", exportFile([], 2), "too-new"],
	])("rejects %s", async (_, json, code) => {
		const error = await importChats(freshStore(), json, null).catch(
			(e: unknown) => e,
		);
		expect(error).toBeInstanceOf(ChatStoreError);
		expect((error as ChatStoreError).code).toBe(code);
	});
});
