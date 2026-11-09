// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readChatModelChoice } from "@/lib/chat/chat-model-choice";
import { readModelChoice } from "@/lib/chat/model-selection";
import { peekOpenChat } from "@/lib/chat/open-chats";
import { createDexieChatStore } from "@/lib/storage/dexie-chat-store";
import { openTestDatabase, textMessage } from "@/lib/storage/test-support";
import {
	addNewPane,
	createWorkspaceFrom,
	createWorkspaceWith,
	openPaneChat,
	openWorkspace,
} from "./workspace-sessions";

// Workspaces and ownership (roadmap 1.9, quality audit Q2 W2 and W4).

function freshStore() {
	return createDexieChatStore({ db: openTestDatabase() });
}

const id = () => crypto.randomUUID();

describe("workspace sessions", () => {
	it("hides another account's panes but keeps them, with their places and widths", async () => {
		const store = freshStore();
		const [mine, theirs] = [id(), id()];
		await store.saveMessages(mine, [textMessage("m1", "user", "hi")], null);
		await store.saveMessages(
			theirs,
			[textMessage("m2", "user", "yo")],
			"user-a",
		);
		const panes = [
			{ chatId: theirs, size: 60, synced: true },
			{ chatId: mine, size: 40, synced: true },
		];
		await store.saveWorkspace({ id: "w", ownerId: null, panes });

		const shown = await openWorkspace("w", null, store);
		expect(shown?.panes).toEqual([{ chatId: mine, size: 100, synced: true }]);
		expect(shown?.hiddenPanes).toEqual([{ pane: panes[0], index: 0 }]);

		const all = await openWorkspace("w", "user-a", store);
		expect(all?.panes).toEqual(panes);
		expect(all?.hiddenPanes).toEqual([]);
	});

	it("treats a workspace with only hidden panes as missing", async () => {
		const store = freshStore();
		const theirs = id();
		await store.saveMessages(
			theirs,
			[textMessage("m", "user", "yo")],
			"user-a",
		);
		await store.saveWorkspace({
			id: "w",
			ownerId: null,
			panes: [{ chatId: theirs, size: 100, synced: true }],
		});
		expect(await openWorkspace("w", null, store)).toBeUndefined();
	});

	it("gives new and never-sent panes to the viewer, not the workspace's owner", async () => {
		const store = freshStore();
		const unsent = id();
		expect(await openPaneChat({ chatId: unsent }, "user-a", store)).toBe(true);
		expect(peekOpenChat(unsent)?.ownerId).toBe("user-a");

		const panes = addNewPane({ panes: [], hiddenPanes: [] }, "user-a", store);
		const added = panes[0]?.chatId ?? "";
		expect(peekOpenChat(added)?.ownerId).toBe("user-a");
		// Three hidden panes plus one shown fill the workspace.
		const hiddenPanes = panes.map((pane) => ({ pane, index: 0 }));
		const full = {
			panes,
			hiddenPanes: [...hiddenPanes, ...hiddenPanes, ...hiddenPanes],
		};
		expect(addNewPane(full, "user-a", store)).toEqual(panes);
	});

	it("makes the workspace from a no-account chat the viewer's", async () => {
		const store = freshStore();
		const solo = id();
		await store.saveMessages(solo, [textMessage("m", "user", "hi")], null);
		const workspaceId = await createWorkspaceFrom(solo, "user-a", store);
		const workspace = await store.getWorkspace(workspaceId);
		expect(workspace?.ownerId).toBe("user-a");
		const added = workspace?.panes[1]?.chatId ?? "";
		expect(peekOpenChat(added)?.ownerId).toBe("user-a");
		expect((await store.getChat(solo))?.ownerId).toBeNull();
	});

	it("restores a layout as a new workspace: fresh chats on its models, widths and sync", async () => {
		const store = freshStore();
		const before = readModelChoice();
		const opus = {
			provider: "openrouter",
			model: "anthropic/claude-opus-5.5",
			gatewayId: "anthropic/claude-opus-5.5",
		} as const;
		const gpt = { provider: "openai", model: "gpt-5.5" } as const;
		const workspaceId = await createWorkspaceWith(
			[
				{ model: opus, size: 30, synced: true },
				{ model: gpt, size: 30, synced: false },
			],
			"user-a",
			store,
		);
		const workspace = await store.getWorkspace(workspaceId);
		expect(workspace?.ownerId).toBe("user-a");
		expect(
			workspace?.panes.map(({ size, synced }) => ({ size, synced })),
		).toEqual([
			{ size: 50, synced: true },
			{ size: 50, synced: false },
		]);
		const [first, second] = workspace?.panes ?? [];
		expect(readChatModelChoice(first?.chatId ?? "")).toEqual(opus);
		expect(readChatModelChoice(second?.chatId ?? "")).toEqual(gpt);
		expect(peekOpenChat(first?.chatId ?? "")?.ownerId).toBe("user-a");
		// A link or layout doesn't change the default for new chats.
		expect(readModelChoice()).toEqual(before);
	});

	it("opens at most four panes from a layout, evenly when it has no widths", async () => {
		const store = freshStore();
		const seeds = Array.from({ length: 6 }, () => ({ model: null }));
		const workspace = await store.getWorkspace(
			await createWorkspaceWith(seeds, null, store),
		);
		expect(workspace?.panes.map((pane) => pane.size)).toEqual([25, 25, 25, 25]);
		await expect(createWorkspaceWith([], null, store)).rejects.toThrow();
	});
});
