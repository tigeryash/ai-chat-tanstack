import { deleteChats } from "@/lib/chat/open-chats";
import { chatStore } from "@/lib/storage/app-store";
import type { ChatStore } from "@/lib/storage/chat-store";
import { isVisibleTo, type Viewer } from "@/lib/storage/ownership";
import { removeChats } from "./pane-layout";

// Deleting workspaces and their chats without touching what the viewer can't see (roadmap 1.9, quality
// audit Q2 W3). A workspace can hold another account's chat (a pane added while signed in to a
// no-account workspace); those panes are hidden from this viewer, so their chats are never deleted
// here, and the record stays with just those panes. Reads the store, not the sidebar, so it acts on
// what's saved now. Imports nothing from the AI SDK, so the sidebar can use it.

/**
 * Deletes a workspace as `viewer` sees it: the chats of its panes the viewer can see (also unsaved
 * ones), except those another workspace also lists, then the record. When panes the viewer can't see
 * remain, the record keeps just those. Does nothing for a workspace the viewer can't see.
 */
export async function deleteWorkspaceAs(
	id: string,
	viewer: Viewer,
	store: ChatStore = chatStore(),
): Promise<void> {
	const workspace = await store.getWorkspace(id);
	if (!workspace || !isVisibleTo(workspace, viewer)) return;
	const [chats, workspaces] = await Promise.all([
		store.listChats(),
		store.listWorkspaces(),
	]);
	const hidden = new Set(
		chats.filter((chat) => !isVisibleTo(chat, viewer)).map((chat) => chat.id),
	);
	const elsewhere = new Set(
		workspaces
			.filter((other) => other.id !== id)
			.flatMap((other) => other.chatIds),
	);
	const shownIds = workspace.panes
		.map((pane) => pane.chatId)
		.filter((chatId) => !hidden.has(chatId));
	await deleteChats(
		shownIds.filter((chatId) => !elsewhere.has(chatId)),
		store,
	);
	const rest = removeChats(workspace.panes, new Set(shownIds));
	if (rest.length === 0) return store.deleteWorkspace(id);
	await store.saveWorkspace({ id, ownerId: workspace.ownerId, panes: rest });
}

/**
 * After these chats are deleted: removes their panes from every workspace, deleting a workspace left
 * with none, so no record points at a deleted chat (it would reopen as an empty pane).
 */
export async function dropDeletedPanes(
	chatIds: readonly string[],
	store: ChatStore = chatStore(),
): Promise<void> {
	const deleted = new Set(chatIds);
	const affected = (await store.listWorkspaces()).filter((workspace) =>
		workspace.chatIds.some((chatId) => deleted.has(chatId)),
	);
	for (const { id } of affected) {
		const workspace = await store.getWorkspace(id);
		if (!workspace) continue;
		const rest = removeChats(workspace.panes, deleted);
		if (rest.length === 0) await store.deleteWorkspace(id);
		else
			await store.saveWorkspace({
				id,
				ownerId: workspace.ownerId,
				panes: rest,
			});
	}
}
