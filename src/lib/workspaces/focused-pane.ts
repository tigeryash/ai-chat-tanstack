// The focused pane and what can be done to it (roadmap R2 S6 shortcuts, S7 palette actions), shared so
// a shortcut and a palette command do the same thing. A workspace pane is a `section[data-pane-id]`; a
// single chat has none, and the whole page counts as its one pane. The page showing panes registers a
// `PaneController` for adding and removing them. In the dashboard shell: no imports, keep it small.

export interface PaneController {
	/** Adds a pane to the right of `afterChatId` (the end when undefined). */
	addPane(afterChatId: string | undefined): void;
	/** Removes this pane; undefined where there's nothing to remove (a single chat). */
	removePane?(chatId: string): void;
}

let controller: PaneController | null = null;
let lastFocusedId: string | null = null;

/** Registers the page's controller; returns the unregister. */
export function registerPaneController(next: PaneController): () => void {
	controller = next;
	return () => {
		if (controller === next) controller = null;
	};
}

function paneSections(): HTMLElement[] {
	return [...document.querySelectorAll<HTMLElement>("section[data-pane-id]")];
}

/** Remembers the pane focus or a click was last in, so a shortcut acts there after focus leaves it. */
export function notePaneInteraction(target: EventTarget | null): void {
	if (!(target instanceof Element)) return;
	const pane = target.closest<HTMLElement>("section[data-pane-id]");
	if (pane?.dataset.paneId) lastFocusedId = pane.dataset.paneId;
}

/** The pane focus is in, else the one last used, else the first; `null` on a single chat. */
export function focusedPane(): HTMLElement | null {
	const sections = paneSections();
	const active = document.activeElement;
	return (
		sections.find((pane) => active && pane.contains(active)) ??
		sections.find((pane) => pane.dataset.paneId === lastFocusedId) ??
		sections[0] ??
		null
	);
}

/** Where to look for the focused pane's controls: the pane, or the page on a single chat. */
function focusedScope(): ParentNode {
	return focusedPane() ?? document;
}

/** Moves focus to pane `index` (from 0). Returns false when there's no such pane. */
export function focusPaneAt(index: number): boolean {
	const pane = paneSections()[index];
	if (!pane) return false;
	lastFocusedId = pane.dataset.paneId ?? null;
	pane.focus();
	return true;
}

/** Puts the cursor in the focused pane's message box. */
export function focusComposer(): boolean {
	const box = focusedScope().querySelector<HTMLElement>(
		"[data-composer-input]",
	);
	box?.focus();
	return box !== null;
}

/** Opens the focused pane's model picker. */
export function openModelPicker(): boolean {
	const trigger = focusedScope().querySelector<HTMLElement>(
		"[data-model-picker]",
	);
	trigger?.click();
	return trigger !== null;
}

/** Adds a pane to the right of the focused one (on a single chat, makes a workspace). */
export function addPaneNextToFocused(): boolean {
	if (!controller) return false;
	controller.addPane(focusedPane()?.dataset.paneId);
	return true;
}

/** Removes the focused pane; a workspace keeps its last one. */
export function removeFocusedPane(): boolean {
	const id = focusedPane()?.dataset.paneId;
	if (!controller?.removePane || !id) return false;
	controller.removePane(id);
	return true;
}
