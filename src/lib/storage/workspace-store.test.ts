import Dexie from "dexie";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { createDexieChatStore } from "./dexie-chat-store";
import { openTestDatabase, tickingClock } from "./test-support";
import { WORKSPACE_FORMAT_VERSION } from "./workspace";

// Workspaces in the chat store (roadmap 3.1): checked on write and on read, kept apart from chats.

function setup() {
	const db = openTestDatabase();
	return { db, store: createDexieChatStore({ db, now: tickingClock() }) };
}

const panes = [
	{ chatId: "a", size: 50, synced: true },
	{ chatId: "b", size: 50, synced: false },
];

describe("workspaces in the chat store", () => {
	it("saves a workspace and reads it back, keeping createdAt on later saves", async () => {
		const { store } = setup();
		const saved = await store.saveWorkspace({ id: "w1", ownerId: null, panes });
		expect(saved).toEqual({
			id: "w1",
			ownerId: null,
			panes,
			createdAt: 1000,
			updatedAt: 1000,
		});
		await store.saveWorkspace({
			id: "w1",
			ownerId: null,
			panes: panes.slice(1),
		});
		expect(await store.getWorkspace("w1")).toMatchObject({
			createdAt: 1000,
			updatedAt: 1001,
			panes: panes.slice(1),
		});
		expect(await store.getWorkspace("missing")).toBeUndefined();
	});

	it("refuses bad workspaces: no panes, too many, or one chat twice", async () => {
		const { store } = setup();
		const pane = (chatId: string) => ({ chatId, size: 20, synced: true });
		for (const bad of [
			[],
			["a", "b", "c", "d", "e"].map(pane),
			[pane("a"), pane("a")],
		]) {
			await expect(
				store.saveWorkspace({ id: "w", ownerId: null, panes: bad }),
			).rejects.toThrow();
		}
	});

	it("won't read or overwrite a workspace from a newer app", async () => {
		const { db, store } = setup();
		await db.workspaces.put({
			id: "w1",
			ownerId: null,
			panes,
			createdAt: 1,
			updatedAt: 1,
			formatVersion: WORKSPACE_FORMAT_VERSION + 1,
		});
		await expect(store.getWorkspace("w1")).rejects.toMatchObject({
			code: "too-new",
		});
		await expect(
			store.saveWorkspace({ id: "w1", ownerId: null, panes }),
		).rejects.toMatchObject({ code: "too-new" });
	});

	it("tells watchers about workspaces, newest first, skipping unreadable ones", async () => {
		Dexie.dependencies.indexedDB ??= new IDBFactory();
		const { db, store } = setup();
		const seen: string[][] = [];
		const stop = store.watchWorkspaces(
			(workspaces) =>
				seen.push(workspaces.map((w) => `${w.id}:${w.chatIds.join("+")}`)),
			(error) => {
				throw error;
			},
		);
		await vi.waitFor(() => expect(seen).toEqual([[]]));
		await store.saveWorkspace({ id: "w1", ownerId: null, panes });
		await store.saveWorkspace({
			id: "w2",
			ownerId: "u1",
			panes: panes.slice(0, 1),
		});
		await db.workspaces.put({ id: "junk", formatVersion: 1 } as never);
		await vi.waitFor(() => expect(seen.at(-1)).toEqual(["w2:a", "w1:a+b"]));

		await store.deleteWorkspace("w2");
		await vi.waitFor(() => expect(seen.at(-1)).toEqual(["w1:a+b"]));
		stop();
	});

	it("deleting a workspace leaves its chats", async () => {
		const { store } = setup();
		await store.saveMessages(
			"a",
			[{ id: "m", role: "user", parts: [{ type: "text", text: "hi" }] }],
			null,
		);
		await store.saveWorkspace({ id: "w1", ownerId: null, panes });
		await store.deleteWorkspace("w1");
		expect(await store.getWorkspace("w1")).toBeUndefined();
		expect(await store.getChat("a")).toBeDefined();
	});
});
