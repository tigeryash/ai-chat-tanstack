import { MAX_PANES, type WorkspacePane } from "@/lib/storage/workspace";

// Pane changes in a workspace (roadmap 3.1), as pure functions that return a new pane list. Adding or
// removing a pane gives every pane an equal width again; resizing keeps the person's widths.

type Panes = readonly WorkspacePane[];

/** Equal widths, rounded to two decimals; the last pane takes the rounding, so they add up to 100. */
function evenly(panes: Panes): WorkspacePane[] {
	const size = Math.floor((100 / panes.length) * 100) / 100;
	const last = Math.round((100 - size * (panes.length - 1)) * 100) / 100;
	return panes.map((pane, index) => ({
		...pane,
		size: index === panes.length - 1 ? last : size,
	}));
}

/** `hidden`: panes the record keeps but the viewer can't see (roadmap 1.9); they count toward the limit. */
export function canAddPane(panes: Panes, hidden = 0): boolean {
	return panes.length + hidden < MAX_PANES;
}

/** Adds a synced pane for `chatId` at the end. No change at the limit or for a chat already shown. */
export function addPane(
	panes: Panes,
	chatId: string,
	hidden = 0,
): WorkspacePane[] {
	if (
		!canAddPane(panes, hidden) ||
		panes.some((pane) => pane.chatId === chatId)
	) {
		return [...panes];
	}
	return evenly([...panes, { chatId, size: 0, synced: true }]);
}

/** Removes a pane. The last pane stays: a workspace always shows at least one. */
export function removePane(panes: Panes, chatId: string): WorkspacePane[] {
	if (panes.length <= 1) return [...panes];
	const rest = panes.filter((pane) => pane.chatId !== chatId);
	return rest.length === panes.length ? [...panes] : evenly(rest);
}

/** Removes the panes of these chats, evening out the rest. May return no panes. */
export function removeChats(
	panes: Panes,
	chatIds: ReadonlySet<string>,
): WorkspacePane[] {
	const rest = panes.filter((pane) => !chatIds.has(pane.chatId));
	return rest.length === panes.length ? [...panes] : evenly(rest);
}

/** Moves a pane one place left (-1) or right (+1), keeping its width. */
export function movePane(
	panes: Panes,
	chatId: string,
	by: -1 | 1,
): WorkspacePane[] {
	const from = panes.findIndex((pane) => pane.chatId === chatId);
	const to = from + by;
	if (from < 0 || to < 0 || to >= panes.length) return [...panes];
	const next = [...panes];
	const [moved] = next.splice(from, 1);
	if (moved) next.splice(to, 0, moved);
	return next;
}

/** Applies widths from the resizable layout (chat id → percentage), ignoring unknown ids. */
export function resizePanes(
	panes: Panes,
	layout: Readonly<Record<string, number>>,
): WorkspacePane[] {
	return panes.map((pane) => {
		const size = layout[pane.chatId];
		return size === undefined || !Number.isFinite(size)
			? pane
			: { ...pane, size: Math.min(100, Math.max(0, size)) };
	});
}

export function setPaneSynced(
	panes: Panes,
	chatId: string,
	synced: boolean,
): WorkspacePane[] {
	return panes.map((pane) =>
		pane.chatId === chatId ? { ...pane, synced } : pane,
	);
}

/** The resizable group's layout for these panes. */
export function layoutOf(panes: Panes): Record<string, number> {
	return Object.fromEntries(panes.map((pane) => [pane.chatId, pane.size]));
}

/** A new workspace's panes: the chats given, synced, in equal widths. */
export function initialPanes(chatIds: readonly string[]): WorkspacePane[] {
	return evenly(
		chatIds
			.slice(0, MAX_PANES)
			.map((chatId) => ({ chatId, size: 0, synced: true })),
	);
}

/** A pane the viewer can't see (another account's chat, roadmap 1.9) and its place in the saved list. */
export interface HiddenPane {
	pane: WorkspacePane;
	index: number;
}

function scaled(panes: Panes, total: number): WorkspacePane[] {
	const sum = panes.reduce((acc, pane) => acc + pane.size, 0);
	if (sum <= 0)
		return evenly(panes).map((pane) => ({
			...pane,
			size: (pane.size * total) / 100,
		}));
	return panes.map((pane) => ({ ...pane, size: (pane.size * total) / sum }));
}

/**
 * Splits a saved pane list into the panes to show, widened to fill the row, and the hidden ones, which
 * the record keeps (quality audit Q2, W2).
 */
export function splitHiddenPanes(
	panes: Panes,
	isShown: (pane: WorkspacePane) => boolean,
): { shown: WorkspacePane[]; hidden: HiddenPane[] } {
	const hidden = panes.flatMap((pane, index) =>
		isShown(pane) ? [] : [{ pane, index }],
	);
	if (hidden.length === 0) return { shown: [...panes], hidden };
	return { shown: scaled(panes.filter(isShown), 100), hidden };
}

/**
 * The pane list to save: the shown panes with the hidden ones back in their places and at their
 * widths; the shown panes share what's left of the row.
 */
export function withHiddenPanes(
	shown: Panes,
	hidden: readonly HiddenPane[],
): WorkspacePane[] {
	if (hidden.length === 0) return [...shown];
	const hiddenWidth = hidden.reduce((acc, { pane }) => acc + pane.size, 0);
	const panes = scaled(shown, Math.max(0, 100 - hiddenWidth));
	for (const { pane, index } of [...hidden].sort((a, b) => a.index - b.index)) {
		panes.splice(Math.min(index, panes.length), 0, pane);
	}
	return panes;
}
