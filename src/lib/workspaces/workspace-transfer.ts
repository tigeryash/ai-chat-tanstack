import type { ChatStore } from "@/lib/storage/chat-store";
import { ChatStoreError } from "@/lib/storage/errors";
import {
	type Newer,
	NOTHING_NEWER,
	newerCopies,
	newerThanHere,
} from "@/lib/storage/newer-copy";
import { isVisibleTo, type Viewer } from "@/lib/storage/ownership";
import {
	MAX_PANES,
	readWorkspace,
	WORKSPACE_FORMAT_VERSION,
	type Workspace,
} from "@/lib/storage/workspace";
import { splitHiddenPanes, withHiddenPanes } from "./pane-layout";
import {
	MAX_SAVED_LAYOUTS,
	parseSavedLayout,
	type SavedLayout,
	type SavedLayoutStore,
} from "./saved-layouts";

// Workspaces and saved layouts in export files (roadmap 1.10, Refine R4), by the chats' rules: an export
// holds what the viewer can see, an import keeps the newer copy and never hands a workspace to the
// signed-in account (a new one keeps the owner in the file, one already here keeps its owner here).
//
// A workspace pane only points at a chat. The export keeps the panes whose chat is in the same file, so
// it never names another account's chat (quality audit Q2, W2). The import drops panes whose chat is
// neither in the file nor on this device, which would reopen as empty panes (like `dropDeletedPanes`),
// and a workspace left without panes isn't written. When a newer copy replaces a workspace here, the
// panes here the viewer can't see are put back, as every save does (`withHiddenPanes`).
//
// Saved layouts hold no chat ids, owners or content, and are shared by every account in this browser,
// so they all travel. Their `savedAt` decides which copy is newer.

export type StoredWorkspace = Workspace & { formatVersion: number };

function toStoredWorkspace(workspace: Workspace): StoredWorkspace {
	return {
		formatVersion: WORKSPACE_FORMAT_VERSION,
		id: workspace.id,
		ownerId: workspace.ownerId,
		panes: workspace.panes.map(({ chatId, size, synced }) => ({
			chatId,
			size,
			synced,
		})),
		createdAt: workspace.createdAt,
		updatedAt: workspace.updatedAt,
	};
}

/** The viewer's workspaces, each with only the panes whose chat is in `chatIds` (the exported chats). */
export async function exportableWorkspaces(
	store: ChatStore,
	viewer: Viewer,
	chatIds: ReadonlySet<string>,
): Promise<StoredWorkspace[]> {
	const visible = (await store.listWorkspaces()).filter((summary) =>
		isVisibleTo(summary, viewer),
	);
	const stored: StoredWorkspace[] = [];
	for (const summary of visible) {
		const workspace = await store.getWorkspace(summary.id).catch((error) => {
			if (error instanceof ChatStoreError) return undefined;
			throw error;
		});
		if (!workspace) continue;
		const { shown } = splitHiddenPanes(workspace.panes, (pane) =>
			chatIds.has(pane.chatId),
		);
		if (shown.length > 0) {
			stored.push(toStoredWorkspace({ ...workspace, panes: shown }));
		}
	}
	return stored;
}

function readFileWorkspace(raw: unknown): Workspace {
	try {
		return readWorkspace(raw);
	} catch (error) {
		if (!(error instanceof ChatStoreError)) throw error;
		throw new ChatStoreError(
			error.code === "too-new" ? "too-new" : "invalid-export",
			"A workspace in the file is invalid.",
		);
	}
}

/**
 * The file's workspaces to write, checked (a bad one fails the import), trimmed to panes with a chat,
 * newer than here. `fileChatIds`: the chats in the same file.
 */
export async function workspacesToImport(
	raw: readonly unknown[] | undefined,
	store: ChatStore,
	viewer: Viewer,
	fileChatIds: ReadonlySet<string>,
): Promise<Newer<Workspace>> {
	if (!raw || raw.length === 0) return NOTHING_NEWER;
	const incoming = raw.map(readFileWorkspace);
	const chats = await store.listChats();
	const known = new Set([...fileChatIds, ...chats.map((chat) => chat.id)]);
	const hiddenHere = new Set(
		chats.filter((chat) => !isVisibleTo(chat, viewer)).map((chat) => chat.id),
	);
	const withChats = incoming.flatMap((workspace) => {
		const { shown } = splitHiddenPanes(workspace.panes, (pane) =>
			known.has(pane.chatId),
		);
		return shown.length > 0 ? [{ ...workspace, panes: shown }] : [];
	});
	const here = await store.listWorkspaces();
	const newer = newerThanHere(withChats, here);
	const items: Workspace[] = [];
	for (const item of newer.items) {
		const merged = await keepHiddenPanes(item, store, hiddenHere);
		if (merged) items.push(merged);
	}
	const hereIds = new Set(here.map((workspace) => workspace.id));
	return {
		items,
		updated: items.filter((item) => hereIds.has(item.id)).length,
		skipped:
			new Set(incoming.map((workspace) => workspace.id)).size - items.length,
	};
}

/**
 * `item` with the panes of the copy here that the viewer can't see put back. Undefined when the copy
 * here can't be replaced: it's from a newer app, or the panes wouldn't fit.
 */
async function keepHiddenPanes(
	item: Workspace,
	store: ChatStore,
	hiddenHere: ReadonlySet<string>,
): Promise<Workspace | undefined> {
	let mine: Workspace | undefined;
	try {
		mine = await store.getWorkspace(item.id);
	} catch (error) {
		if (!(error instanceof ChatStoreError)) throw error;
		return undefined;
	}
	if (!mine) return item;
	const { hidden } = splitHiddenPanes(
		mine.panes,
		(pane) => !hiddenHere.has(pane.chatId),
	);
	if (hidden.length === 0) return item;
	const hiddenIds = new Set(hidden.map(({ pane }) => pane.chatId));
	const shown = item.panes.filter((pane) => !hiddenIds.has(pane.chatId));
	if (shown.length === 0 || shown.length + hidden.length > MAX_PANES) {
		return undefined;
	}
	return { ...item, panes: withHiddenPanes(shown, hidden) };
}

export function exportableLayouts(layouts: SavedLayoutStore): SavedLayout[] {
	return layouts.read();
}

/** The file's saved layouts, checked (a bad one fails the import), newer than here. */
export function layoutsToImport(
	raw: readonly unknown[] | undefined,
	layouts: SavedLayoutStore,
): Newer<SavedLayout> {
	if (!raw || raw.length === 0) return NOTHING_NEWER;
	const incoming = raw.map((entry) => {
		const layout = parseSavedLayout(entry);
		if (!layout) {
			throw new ChatStoreError(
				"invalid-export",
				"A saved layout in the file is invalid.",
			);
		}
		return layout;
	});
	return newerCopies(incoming, layouts.read(), (layout) => layout.savedAt);
}

/** Writes imported layouts over the copies here, keeping the newest MAX_SAVED_LAYOUTS. */
export function putLayouts(
	layouts: SavedLayoutStore,
	imported: readonly SavedLayout[],
): void {
	if (imported.length === 0) return;
	const replaced = new Set(imported.map((layout) => layout.id));
	const kept = layouts.read().filter((layout) => !replaced.has(layout.id));
	layouts.write(
		[...kept, ...imported]
			.sort((a, b) => a.savedAt - b.savedAt)
			.slice(-MAX_SAVED_LAYOUTS),
	);
}
