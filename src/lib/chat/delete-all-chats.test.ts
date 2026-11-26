import { describe, expect, it } from "vitest";
import { createDexieChatStore } from "@/lib/storage/dexie-chat-store";
import { openTestDatabase, textMessage } from "@/lib/storage/test-support";
import { initialPanes } from "@/lib/workspaces/pane-layout";
import { deleteAllChats } from "./delete-all-chats";

async function setup() {
	const store = createDexieChatStore({ db: openTestDatabase() });
	const chats = { mine: "user-a", shared: null, theirs: "user-b" } as const;
	for (const [id, ownerId] of Object.entries(chats)) {
		await store.saveMessages(id, [textMessage(`${id}-m`, "user", id)], ownerId);
	}
	const ids = async () => (await store.listChats()).map((c) => c.id).sort();
	return { store, ids };
}

describe("delete all chats", () => {
	it("signed out, deletes only no-account chats", async () => {
		const { store, ids } = await setup();
		expect(await deleteAllChats(null, store)).toBe(1);
		expect(await ids()).toEqual(["mine", "theirs"]);
	});

	it("signed in, deletes the account's and no-account chats, never another account's", async () => {
		const { store, ids } = await setup();
		expect(await deleteAllChats("user-a", store)).toBe(2);
		expect(await ids()).toEqual(["theirs"]);
	});

	it("deletes the viewer's workspaces, and keeps another account's panes", async () => {
		const { store } = await setup();
		await store.saveWorkspace({
			id: "w-mine",
			ownerId: "user-a",
			panes: initialPanes(["mine", "shared"]),
		});
		await store.saveWorkspace({
			id: "w-theirs",
			ownerId: "user-b",
			panes: initialPanes(["theirs", "shared"]),
		});
		await deleteAllChats("user-a", store);
		expect(await store.getWorkspace("w-mine")).toBeUndefined();
		const left = await store.getWorkspace("w-theirs");
		expect(left?.panes.map((pane) => pane.chatId)).toEqual(["theirs"]);
	});
});
