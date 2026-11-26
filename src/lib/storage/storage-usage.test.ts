import type { UIMessage } from "ai";
import Dexie from "dexie";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createDexieChatStore } from "./dexie-chat-store";
import { localChatUsage, watchLocalChatUsage } from "./storage-usage";
import { openTestDatabase, textMessage } from "./test-support";

const PNG =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==";

function withImages(id: string, count: number): UIMessage {
	return {
		id,
		role: "user",
		parts: [
			...Array.from({ length: count }, (_, i) => ({
				type: "file" as const,
				mediaType: "image/png",
				filename: `f${i}.png`,
				url: PNG,
			})),
			{ type: "text", text: "Look" },
		],
	};
}

async function setup() {
	const store = createDexieChatStore({ db: openTestDatabase() });
	await store.saveMessages("mine", [withImages("m1", 2)], "user-a");
	await store.saveMessages("shared", [withImages("m2", 1)], null);
	await store.saveMessages("theirs", [withImages("m3", 3)], "user-b");
	await store.saveMessages("plain", [textMessage("m4", "user", "hi")], null);
	return store;
}

describe("local chat usage", () => {
	it("counts only the chats a signed-out viewer can see, and their files", async () => {
		const store = await setup();
		expect(await localChatUsage(store, await store.listChats(), null)).toEqual({
			chats: 2,
			attachments: 1,
		});
	});

	it("counts the account's chats plus no-account ones, never another account's", async () => {
		const store = await setup();
		expect(
			await localChatUsage(store, await store.listChats(), "user-a"),
		).toEqual({ chats: 3, attachments: 3 });
	});

	it("is zero with no chats", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		expect(await localChatUsage(store, [], null)).toEqual({
			chats: 0,
			attachments: 0,
		});
	});

	it("reports again after a chat is deleted", async () => {
		// liveQuery stays idle without a global IndexedDB, which Node doesn't have.
		Dexie.dependencies.indexedDB ??= new IDBFactory();
		const store = await setup();
		const seen: number[] = [];
		const stop = watchLocalChatUsage(
			store,
			null,
			(usage) => seen.push(usage.attachments),
			(error) => {
				throw error;
			},
		);
		await expect.poll(() => seen.at(-1)).toBe(1);
		await store.deleteChat("shared");
		await expect.poll(() => seen.at(-1)).toBe(0);
		stop();
	});
});
