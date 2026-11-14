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
	Shift: "⇧",
	Alt: "⌥",
};
const OTHER_KEYS: Record<string, string> = { Mod: "Ctrl" };

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
