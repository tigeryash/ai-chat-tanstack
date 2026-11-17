import type { Shortcut } from "./command";

// Shortcut keys (docs/settings-research.md "Shortcuts"): ⌘ on a Mac, Ctrl elsewhere. Kept apart from
// the registry so the dashboard shell can listen for Cmd+K without loading the palette.

/** True on macOS and iOS, where "Mod" is ⌘. */
export function isApplePlatform(
	nav:
		| { platform?: string; userAgent?: string }
		| undefined = typeof navigator === "undefined" ? undefined : navigator,
): boolean {
	if (!nav) return false;
	return /Mac|iPhone|iPad|iPod/.test(nav.platform || nav.userAgent || "");
}

type KeyEventLike = Pick<
	KeyboardEvent,
	"key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

/**
 * Cmd+K on a Mac, Ctrl+K elsewhere. On a Mac, Ctrl+K stays the text fields' "delete to the end of the
 * line".
 */
export function isCommandPaletteShortcut(
	event: KeyEventLike,
	apple = isApplePlatform(),
): boolean {
	const mod = apple
		? event.metaKey && !event.ctrlKey
		: event.ctrlKey && !event.metaKey;
	return (
		mod && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k"
	);
}

const APPLE_KEYS: Record<string, string> = {
	Mod: "⌘",
	Ctrl: "⌃",
	Shift: "⇧",
	Alt: "⌥",
	Escape: "Esc",
};
const OTHER_KEYS: Record<string, string> = { Mod: "Ctrl", Escape: "Esc" };

/** Each key as shown: `["⌘", "K"]` on a Mac, `["Ctrl", "K"]` elsewhere. */
export function shortcutKeys(
	shortcut: Shortcut,
	apple = isApplePlatform(),
): string[] {
	const names = apple ? APPLE_KEYS : OTHER_KEYS;
	return shortcut.map((key) => names[key] ?? key);
}

/** How a screen reader and a tooltip say it: "⌘K", "Ctrl+K". */
export function shortcutLabel(
	shortcut: Shortcut,
	apple = isApplePlatform(),
): string {
	return shortcutKeys(shortcut, apple).join(apple ? "" : "+");
}

// Physical keys, for keys whose character changes with Shift or the layout (Shift+Backslash types "|").
const KEY_CODES: Record<string, string> = {
	"\\": "Backslash",
	"/": "Slash",
	",": "Comma",
};

function keyMatches(event: KeyEventLike & { code?: string }, key: string) {
	if (event.key.toLowerCase() === key.toLowerCase()) return true;
	const code = KEY_CODES[key] ?? (/^[0-9]$/.test(key) ? `Digit${key}` : "");
	return code !== "" && event.code === code;
}

/**
 * Whether the event is this shortcut: its modifiers exactly ("Mod" is ⌘ on a Mac, Ctrl elsewhere) and
 * its last key. A key typed with Shift on every layout ("?") ignores Shift.
 */
export function matchesShortcut(
	event: KeyEventLike & { code?: string },
	shortcut: Shortcut,
	apple = isApplePlatform(),
): boolean {
	const key = shortcut[shortcut.length - 1];
	if (key === undefined) return false;
	const mods = new Set(shortcut.slice(0, -1));
	const meta = mods.has("Mod") && apple;
	const ctrl = (mods.has("Mod") && !apple) || mods.has("Ctrl");
	const shiftFree = key === "?";
	return (
		event.metaKey === meta &&
		event.ctrlKey === ctrl &&
		event.altKey === mods.has("Alt") &&
		(shiftFree || event.shiftKey === mods.has("Shift")) &&
		keyMatches(event, key)
	);
}

const TEXT_INPUT_TYPES = new Set([
	"text",
	"search",
	"email",
	"url",
	"tel",
	"password",
	"number",
	"date",
	"datetime-local",
	"month",
	"time",
	"week",
]);

/** Whether keys pressed here type text: a text field, a select or anything editable. */
export function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	if (target instanceof HTMLTextAreaElement) return !target.readOnly;
	if (target instanceof HTMLSelectElement) return true;
	if (target instanceof HTMLInputElement) {
		return TEXT_INPUT_TYPES.has(target.type) && !target.readOnly;
	}
	return false;
}
