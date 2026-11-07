import { describe, expect, it } from "vitest";
import { createDexieChatStore } from "@/lib/storage/dexie-chat-store";
import { openTestDatabase, textMessage } from "@/lib/storage/test-support";
import { initialPanes } from "./pane-layout";
import { deleteWorkspaceAs, dropDeletedPanes } from "./workspace-cleanup";

// Quality audit Q2, W3: deleting a workspace never deletes a chat the viewer can't see.

async function setup(chats: Record<string, string | null>) {
	const store = createDexieChatStore({ db: openTestDatabase() });
	for (const [id, ownerId] of Object.entries(chats)) {
		await store.saveMessages(id, [textMessage(`${id}-m`, "user", id)], ownerId);
	}
	const workspace = (id: string, ownerId: string | null, chatIds: string[]) =>
		store.saveWorkspace({ id, ownerId, panes: initialPanes(chatIds) });
	const exists = async (id: string) => (await store.getChat(id)) !== undefined;
	return { store, workspace, exists };
}

describe("workspace cleanup", () => {
	it("deletes the viewer's chats and the record when every pane is theirs", async () => {
		const { store, workspace, exists } = await setup({ a: null, b: null });
		await workspace("w", null, ["a", "b", "unsaved"]);
		await deleteWorkspaceAs("w", null, store);
		expect(await store.getWorkspace("w")).toBeUndefined();
		expect(await exists("a")).toBe(false);
		expect(await exists("b")).toBe(false);
	});

	it("keeps another account's chats and the record with just their panes", async () => {
		const { store, workspace, exists } = await setup({
			mine: null,
			theirs: "user-a",
		});
		await workspace("w", null, ["mine", "theirs"]);
		await deleteWorkspaceAs("w", null, store);
		expect(await exists("mine")).toBe(false);
		expect(await exists("theirs")).toBe(true);
		expect(await store.getWorkspace("w")).toMatchObject({
			ownerId: null,
			panes: [{ chatId: "theirs", size: 100 }],
		});
	});

	it("keeps a chat another workspace still lists", async () => {
		const { store, workspace, exists } = await setup({ a: null, b: null });
		await workspace("old", null, ["a"]);
		await workspace("new", null, ["a", "b"]);
		await deleteWorkspaceAs("new", null, store);
		expect(await exists("a")).toBe(true);
		expect(await exists("b")).toBe(false);
		expect(await store.getWorkspace("old")).toBeDefined();
	});

	it("does nothing to a workspace the viewer can't see", async () => {
		const { store, workspace, exists } = await setup({ a: "user-a" });
		await workspace("w", "user-a", ["a"]);
		await deleteWorkspaceAs("w", "user-b", store);
		expect(await store.getWorkspace("w")).toBeDefined();
		expect(await exists("a")).toBe(true);
	});

	it("drops deleted chats' panes, and workspaces left with none", async () => {
		const { store, workspace } = await setup({ a: null, b: null, c: null });
		await workspace("some", null, ["a", "b"]);
		await workspace("all", null, ["c"]);
		await workspace("none", null, ["b"]);
		await dropDeletedPanes(["a", "c"], store);
		expect((await store.getWorkspace("some"))?.panes).toEqual([
			{ chatId: "b", size: 100, synced: true },
		]);
		expect(await store.getWorkspace("all")).toBeUndefined();
		expect(await store.getWorkspace("none")).toBeDefined();
	});
});
