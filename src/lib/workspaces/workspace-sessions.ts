import { holdChatModelChoice } from "@/lib/chat/chat-model-choice";
import { openChat, openNewChat } from "@/lib/chat/chat-sessions";
import { loadChatSettings } from "@/lib/chat/chat-settings";
import { getOpenChat } from "@/lib/chat/open-chats";
import { chatStore } from "@/lib/storage/app-store";
import type { ChatStore } from "@/lib/storage/chat-store";
import { isVisibleTo, type Viewer } from "@/lib/storage/ownership";
import type { Workspace, WorkspacePane } from "@/lib/storage/workspace";
import {
	addPane,
	type HiddenPane,
	initialPanes,
	splitHiddenPanes,
} from "./pane-layout";

// Opening and creating workspaces (roadmap 3.1). Every pane's chat is opened through chat-sessions, so
// it saves, reports tab status (3.10) and keeps streaming like any chat. A pane whose chat was never
// saved (no reply yet) opens empty under the same id. Every pane holds its own model choice, so a pick
// in one pane doesn't move the others. This module loads the chat engine, so routes import it with
// `import()`.
//
// Ownership (roadmap 1.9, quality audit Q2 W2/W4): a pane whose chat belongs to another account is
// hidden but stays in the record, and a new pane's chat belongs to whoever adds it, like any chat.

/** An opened workspace: the panes to show, plus the hidden ones its saves put back. */
export interface OpenWorkspace extends Workspace {
	hiddenPanes: HiddenPane[];
}

/**
 * Opens one pane's chat: from this tab if it's open, else from the store (also after this tab released
 * it). False when it belongs to another account, so the pane is hidden. A pane never sent from opens
 * empty, as the viewer's.
 */
export async function openPaneChat(
	pane: Pick<WorkspacePane, "chatId">,
	viewer: Viewer,
	store: ChatStore = chatStore(),
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
		ownerId: saved?.ownerId ?? viewer,
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
): Promise<OpenWorkspace | undefined> {
	const workspace = await store.getWorkspace(id);
	if (!workspace || !isVisibleTo(workspace, viewer)) return undefined;
	const visible = await Promise.all(
		workspace.panes.map((pane) => openPaneChat(pane, viewer, store)),
	);
	const shownIds = new Set(
		workspace.panes.flatMap((pane, index) =>
			visible[index] ? [pane.chatId] : [],
		),
	);
	const { shown, hidden } = splitHiddenPanes(workspace.panes, (pane) =>
		shownIds.has(pane.chatId),
	);
	if (shown.length === 0) return undefined;
	return { ...workspace, panes: shown, hiddenPanes: hidden };
}

/**
 * "Add pane" on a single chat: a new workspace with that chat and a new empty one beside it, both the
 * viewer's, whoever owns the shown chat. Returns the workspace's id.
 */
export async function createWorkspaceFrom(
	chatId: string,
	viewer: Viewer,
	store: ChatStore = chatStore(),
): Promise<string> {
	const added = openNewChat({ ownerId: viewer, store });
	const shown = getOpenChat(chatId)?.chat;
	holdChatModelChoice(chatId, shown?.messages);
	holdChatModelChoice(added.id);
	const workspace = await store.saveWorkspace({
		id: crypto.randomUUID(),
		ownerId: viewer,
		panes: initialPanes([chatId, added.id]),
	});
	return workspace.id;
}

/** Adds a new empty pane whose chat is the viewer's, whoever owns the workspace. Returns the new pane list. */
export function addNewPane(
	workspace: Pick<OpenWorkspace, "panes" | "hiddenPanes">,
	viewer: Viewer,
	store: ChatStore = chatStore(),
): WorkspacePane[] {
	const added = openNewChat({ ownerId: viewer, store });
	holdChatModelChoice(added.id);
	return addPane(workspace.panes, added.id, workspace.hiddenPanes.length);
}
