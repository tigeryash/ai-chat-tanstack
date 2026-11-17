import type { Shortcut } from "./command";
import { PANE_COMMAND_IDS } from "./pane-command-ids";
import { isApplePlatform, matchesShortcut } from "./shortcut";

// Every keyboard shortcut (roadmap R2 S6, docs/settings-research.md "Shortcuts"), the one place one is
// written down. Commands take theirs from here (`shortcutOf`), and the shortcut sheet and Settings →
// Keyboard list this table. It's in the dashboard shell (the key listener reads it), so it holds data
// only. Browser-reserved keys (Cmd+N/T/W/L/R/F, Cmd+1–9, DevTools keys) stay free.

export type ShortcutArea = "general" | "chat" | "panes";

export const SHORTCUT_AREAS: readonly { id: ShortcutArea; label: string }[] = [
	{ id: "general", label: "General" },
	{ id: "chat", label: "Chat" },
	{ id: "panes", label: "Panes" },
];

export type ShortcutId =
	| "command-palette"
	| "new-chat"
	| "toggle-sidebar"
	| "open-settings"
	| "show-shortcuts"
	| "focus-composer"
	| "focus-pane"
	// The palette's pane actions (R2 S7) carry their command ids, so their rows show the keys.
	| typeof PANE_COMMAND_IDS.switchModel
	| typeof PANE_COMMAND_IDS.add
	| typeof PANE_COMMAND_IDS.remove;

export interface ShortcutBinding {
	id: ShortcutId;
	title: string;
	area: ShortcutArea;
	/** The keys, or per platform when a Mac needs others. */
	keys: Shortcut | { apple: Shortcut; other: Shortcut };
	/** Another way to press it, shown after the first. */
	alt?: Shortcut;
	/** Works while typing in a field though it has no ⌘, Ctrl or Alt (Shift+Esc types nothing). */
	inFields?: boolean;
}

/** Stands for the keys 1 to 4, one per pane. */
export const PANE_DIGITS = "1–4";

export const SHORTCUTS: readonly ShortcutBinding[] = [
	{
		id: "command-palette",
		title: "Command palette",
		area: "general",
		keys: ["Mod", "K"],
	},
	{
		id: "show-shortcuts",
		title: "Keyboard shortcuts",
		area: "general",
		keys: ["Mod", "/"],
		alt: ["?"],
	},
	{
		id: "open-settings",
		title: "Open Settings",
		area: "general",
		keys: ["Mod", ","],
	},
	{
		id: "toggle-sidebar",
		title: "Toggle sidebar",
		area: "general",
		keys: ["Mod", "B"],
	},
	{
		id: "new-chat",
		title: "New chat",
		area: "chat",
		keys: ["Mod", "Shift", "O"],
	},
	{
		id: "focus-composer",
		title: "Focus the message box",
		area: "chat",
		keys: ["Shift", "Escape"],
		inFields: true,
	},
	{
		id: PANE_COMMAND_IDS.switchModel,
		title: "Switch model in the focused pane",
		area: "chat",
		keys: ["Mod", "Shift", "M"],
	},
	{
		id: PANE_COMMAND_IDS.add,
		title: "Add a pane",
		area: "panes",
		keys: ["Mod", "\\"],
	},
	{
		id: PANE_COMMAND_IDS.remove,
		title: "Remove the focused pane",
		area: "panes",
		keys: ["Mod", "Shift", "\\"],
	},
	{
		id: "focus-pane",
		title: "Focus pane 1–4",
		area: "panes",
		// Cmd+1–9 switch browser tabs on a Mac, and Ctrl+1–9 elsewhere.
		keys: { apple: ["Ctrl", PANE_DIGITS], other: ["Alt", PANE_DIGITS] },
	},
];

/** A binding's keys on this platform. */
export function keysOf(binding: ShortcutBinding, apple: boolean): Shortcut {
	const { keys } = binding;
	return "apple" in keys ? (apple ? keys.apple : keys.other) : keys;
}

export function shortcutBinding(id: ShortcutId): ShortcutBinding {
	const binding = SHORTCUTS.find((entry) => entry.id === id);
	if (!binding) throw new Error(`Unknown shortcut: ${id}`);
	return binding;
}

/** A command's shortcut, for a binding that is the same on every platform. */
export function shortcutOf(id: ShortcutId): Shortcut {
	const { keys } = shortcutBinding(id);
	if ("apple" in keys) throw new Error(`${id} differs by platform`);
	return keys;
}

export interface PressedShortcut {
	binding: ShortcutBinding;
	/** Whether it may run while typing in a field (see `worksWhileTyping`). */
	inFields: boolean;
	/** For "focus-pane": which pane, from 0. */
	pane?: number;
}

/** The shortcut this key event presses, if any. */
export function pressedShortcut(
	event: Parameters<typeof matchesShortcut>[0],
	apple = isApplePlatform(),
): PressedShortcut | null {
	for (const binding of SHORTCUTS) {
		for (const keys of [keysOf(binding, apple), binding.alt]) {
			if (!keys) continue;
			if (keys[keys.length - 1] === PANE_DIGITS) {
				for (let pane = 0; pane < 4; pane++) {
					const digit = [...keys.slice(0, -1), String(pane + 1)];
					if (matchesShortcut(event, digit, apple)) {
						return { binding, pane, inFields: worksWhileTyping(binding, keys) };
					}
				}
			} else if (matchesShortcut(event, keys, apple)) {
				return { binding, inFields: worksWhileTyping(binding, keys) };
			}
		}
	}
	return null;
}

/**
 * Keys with ⌘, Ctrl or Alt type no characters, so they work while typing in a field (Yash, 2026-11-14);
 * plain keys like `?` don't. AltGr arrives as Ctrl+Alt and types characters, but an Alt binding never
 * matches with Ctrl held (`matchesShortcut` checks every modifier).
 */
export function worksWhileTyping(
	binding: ShortcutBinding,
	keys: Shortcut,
): boolean {
	return (
		binding.inFields === true ||
		keys.some((key) => key === "Mod" || key === "Ctrl" || key === "Alt")
	);
}
