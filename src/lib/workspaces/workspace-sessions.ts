import { holdChatModelChoice } from "@/lib/chat/chat-model-choice";
import { openChat, openNewChat } from "@/lib/chat/chat-sessions";
import { loadChatSettings } from "@/lib/chat/chat-settings";
import { getOpenChat } from "@/lib/chat/open-chats";
import { chatStore } from "@/lib/storage/app-store";
import type { ChatStore } from "@/lib/storage/chat-store";
import { isVisibleTo, type Viewer } from "@/lib/storage/ownership";
import type { Workspace, WorkspacePane } from "@/lib/storage/workspace";
import { addPane, initialPanes } from "./pane-layout";

// Opening and creating workspaces (roadmap 3.1). Every pane's chat is opened through chat-sessions, so
// it saves, reports tab status (3.10) and keeps streaming like any chat. A pane whose chat was never
// saved (no reply yet) opens empty under the same id. Every pane holds its own model choice, so a pick
// in one pane doesn't move the others. This module loads the chat engine, so routes import it with
// `import()`.

/** Opens one pane's chat. False when it belongs to another account, so the pane is left out. */
async function openPaneChat(
	pane: WorkspacePane,
	workspace: Workspace,
	viewer: Viewer,
	store: ChatStore,
): Promise<boolean> {
	const open = getOpenChat(pane.chatId);
	if (open) {
		holdChatModelChoice(open.chat.id, open.chat.messages);
		return isVisibleTo(open, viewer);
	}
	const saved = await store.getChat(pane.chatId);
	if (saved && !isVisibleTo(saved, viewer)) return false;
	if (saved) loadChatSettings(saved.id, saved.settings);
	const chat = openChat(pane.chatId, {
		messages: saved?.messages,
		store,
		ownerId: saved?.ownerId ?? workspace.ownerId,
	});
	holdChatModelChoice(chat.id, chat.messages);
	return true;
}

/**
 * Opens a stored workspace and every pane's chat. Undefined when there's no such workspace in this
 * browser, or it belongs to another account than `viewer`'s (roadmap 1.9).
 */
export async function openWorkspace(
	id: string,
	viewer: Viewer,
	store: ChatStore = chatStore(),
): Promise<Workspace | undefined> {
	const workspace = await store.getWorkspace(id);
	if (!workspace || !isVisibleTo(workspace, viewer)) return undefined;
	const shown = await Promise.all(
		workspace.panes.map((pane) => openPaneChat(pane, workspace, viewer, store)),
	);
	const panes = workspace.panes.filter((_, index) => shown[index]);
	if (panes.length === 0) return undefined;
	return { ...workspace, panes };
}

/**
 * "Add pane" on a single chat: a new workspace with that chat and a new empty one beside it. Returns
 * the workspace's id.
 */
export async function createWorkspaceFrom(
	chatId: string,
	ownerId: string | null,
	store: ChatStore = chatStore(),
): Promise<string> {
	const added = openNewChat({ ownerId, store });
	const shown = getOpenChat(chatId)?.chat;
	holdChatModelChoice(chatId, shown?.messages);
	holdChatModelChoice(added.id);
	const workspace = await store.saveWorkspace({
		id: crypto.randomUUID(),
		ownerId,
		panes: initialPanes([chatId, added.id]),
	});
	return workspace.id;
}

/** Adds a new empty pane, owned like the workspace. Returns the new pane list. */
export function addNewPane(
	workspace: Pick<Workspace, "panes" | "ownerId">,
	store: ChatStore = chatStore(),
): WorkspacePane[] {
	const added = openNewChat({ ownerId: workspace.ownerId, store });
	holdChatModelChoice(added.id);
	return addPane(workspace.panes, added.id);
}
