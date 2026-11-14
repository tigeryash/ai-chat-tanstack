import { useSyncExternalStore } from "react";
import type { ModelChoice } from "@/lib/chat/model-selection";
import type { HostOption } from "@/lib/hosts/host-options";
import type { ProviderId } from "@/lib/keys/providers";
import type { CatalogModel } from "@/lib/models/catalog";
import type { Prompt } from "@/lib/prompts/prompt";

// The panes on screen and which one is focused (roadmap R2 S7): the last pane the person clicked or
// moved focus into, else pane 1. Each chat screen (a workspace pane, or a single chat as pane 1)
// registers its controls here: the same functions its own buttons call. The command palette's pane
// actions and S6's keyboard shortcuts act on `focusedPane()`. Imports only types, so the palette and
// the shortcuts can read it without loading the chat engine.

/** What a pane's model header knows, for the palette's "Switch model" and "Switch host" pages. */
export interface PaneModel {
	/** The chat's choice, resolved to the host it runs on now. */
	choice: ModelChoice | null;
	/** What the person picked: Auto or a pinned host. */
	wanted: ModelChoice | null;
	catalog: readonly CatalogModel[];
	/** Providers with a key in this browser; null while loading. */
	connected: ReadonlySet<ProviderId> | null;
	hosts: readonly HostOption[];
	/** The model picker's own pick: the same model keeps its host settings, another starts on Auto. */
	pick(choice: ModelChoice): void;
	/** Picks a catalog model as its picker row does (Auto host, unless it's the same model). */
	pickCatalogModel(model: CatalogModel): void;
	/** The host switcher's own change. */
	setChoice(choice: ModelChoice): void;
}

export interface PaneControls {
	chatId: string;
	/** 0-based position among the panes. */
	index: number;
	/** "Pane 2". */
	label: string;
	/** A reply is on its way. */
	busy: boolean;
	model: PaneModel;
	/** Stops this pane's reply (the pane's own Stop). */
	stop(): void;
	/** The last reply's text, without reasoning or tool output. Undefined without a reply. */
	lastReplyText?: () => string;
	/** Regenerates the last reply, as its own button does. Undefined while busy or without one. */
	regenerate?: () => void;
	/** Opens the pane's Model settings sheet. Undefined before a model is picked. */
	openModelSettings?: () => void;
	/** Makes a saved prompt this pane's own system prompt, as Model settings → Apply does. */
	applyPrompt(prompt: Prompt): void;
	/** Only in a workspace: whether the pane is synced, and its switch. */
	synced?: boolean;
	setSynced?: (synced: boolean) => void;
	/** Undefined when there's no room for another pane. */
	addPane?: () => void;
	/** Undefined for the last pane. */
	removePane?: () => void;
}

export interface FocusedPaneState {
	/** Every registered pane, in pane order. */
	panes: readonly PaneControls[];
	/** The focused pane, else the first. Undefined with no chat on screen. */
	focused: PaneControls | undefined;
}

const registered = new Map<string, PaneControls>();
let focusedId: string | undefined;
let state: FocusedPaneState = { panes: [], focused: undefined };
const listeners = new Set<() => void>();

function changed() {
	const panes = [...registered.values()].sort((a, b) => a.index - b.index);
	const focused =
		(focusedId === undefined ? undefined : registered.get(focusedId)) ??
		panes[0];
	state = { panes, focused };
	for (const listener of listeners) listener();
}

/** Adds a pane, or replaces its controls (call it on every render; `unregisterPane` when it goes). */
export function registerPane(controls: PaneControls): void {
	if (registered.get(controls.chatId) === controls) return;
	registered.set(controls.chatId, controls);
	changed();
}

export function unregisterPane(chatId: string): void {
	if (!registered.delete(chatId)) return;
	changed();
}

/** Marks the pane showing `chatId` as focused: the person clicked or tabbed into it. */
export function focusPane(chatId: string): void {
	if (focusedId === chatId) return;
	focusedId = chatId;
	changed();
}

export function focusedPaneState(): FocusedPaneState {
	return state;
}

/** The pane actions act on: the last one interacted with, else pane 1. */
export function focusedPane(): PaneControls | undefined {
	return state.focused;
}

/** Stops every pane that's replying, synced or not. */
export function stopAllPanes(): void {
	for (const pane of state.panes) {
		if (pane.busy) pane.stop();
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function useFocusedPaneState(): FocusedPaneState {
	return useSyncExternalStore(subscribe, focusedPaneState, focusedPaneState);
}
