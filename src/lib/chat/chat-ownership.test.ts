// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createDexieChatStore } from "@/lib/storage/dexie-chat-store";
import { openTestDatabase, textMessage } from "@/lib/storage/test-support";
import { initialPanes } from "@/lib/workspaces/pane-layout";
import { answerNoAccountPrompt, removeAccountChats } from "./chat-ownership";

// Workspaces follow their chats on every answer (Yash, 2026-11-07; quality audit Q2, W4).

async function setup() {
	const store = createDexieChatStore({ db: openTestDatabase() });
	const chats = {
		solo: null,
		a1: null,
		a2: null,
		mine: "user-a",
		other: "user-b",
	};
	for (const [id, ownerId] of Object.entries(chats)) {
		await store.saveMessages(id, [textMessage(`${id}-m`, "user", id)], ownerId);
	}
	// A no-account workspace with a pane of another account's chat, and one of user-a's own.
	await store.saveWorkspace({
		id: "no-account",
		ownerId: null,
		panes: initialPanes(["a1", "a2", "other"]),
	});
	await store.saveWorkspace({
		id: "account",
		ownerId: "user-a",
		panes: initialPanes(["mine", "solo"]),
	});
	const owners = async () =>
		Object.fromEntries(
			(await store.listChats()).map((chat) => [chat.id, chat.ownerId]),
		);
	return { store, owners };
}

beforeEach(() => localStorage.clear());

describe("chat ownership with workspaces", () => {
	it('"add" moves no-account workspaces to the account with their chats', async () => {
		const { store, owners } = await setup();
		await answerNoAccountPrompt("add", "user-a", store);
		expect((await store.getWorkspace("no-account"))?.ownerId).toBe("user-a");
		expect(await owners()).toMatchObject({ a1: "user-a", other: "user-b" });
	});

	it('"keep" leaves them', async () => {
		const { store } = await setup();
		await answerNoAccountPrompt("keep", "user-a", store);
		expect((await store.getWorkspace("no-account"))?.ownerId).toBeNull();
	});

	it('"delete" deletes them, keeping panes of an account\'s chats', async () => {
		const { store, owners } = await setup();
		await answerNoAccountPrompt("delete", "user-a", store);
		expect(await owners()).toEqual({ mine: "user-a", other: "user-b" });
		expect((await store.getWorkspace("no-account"))?.panes).toEqual([
			{ chatId: "other", size: 100, synced: true },
		]);
		// The account's workspace loses the deleted no-account chat's pane.
		expect(
			(await store.getWorkspace("account"))?.panes.map((pane) => pane.chatId),
		).toEqual(["mine"]);
	});

	it("removing the account's chats deletes its workspaces and their panes elsewhere", async () => {
		const { store, owners } = await setup();
		await store.saveWorkspace({
			id: "mixed",
			ownerId: null,
			panes: initialPanes(["mine", "a1"]),
		});
		await removeAccountChats("user-a", store);
		expect(await store.getWorkspace("account")).toBeUndefined();
		expect(await owners()).not.toHaveProperty("mine");
		expect(await owners()).toHaveProperty("solo", null);
		expect(
			(await store.getWorkspace("mixed"))?.panes.map((pane) => pane.chatId),
		).toEqual(["a1"]);
	});
});
