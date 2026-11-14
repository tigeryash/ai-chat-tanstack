import { describe, expect, it } from "vitest";
import {
	isApplePlatform,
	isCommandPaletteShortcut,
	shortcutKeys,
	shortcutLabel,
} from "./shortcut";

const key = (init: Partial<KeyboardEvent>) => ({
	key: "k",
	metaKey: false,
	ctrlKey: false,
	altKey: false,
	shiftKey: false,
	...init,
});

describe("isCommandPaletteShortcut", () => {
	it("is Cmd+K on a Mac and Ctrl+K elsewhere", () => {
		expect(isCommandPaletteShortcut(key({ metaKey: true }), true)).toBe(true);
		expect(isCommandPaletteShortcut(key({ ctrlKey: true }), true)).toBe(false);
		expect(isCommandPaletteShortcut(key({ ctrlKey: true }), false)).toBe(true);
		expect(isCommandPaletteShortcut(key({ metaKey: true }), false)).toBe(false);
		expect(
			isCommandPaletteShortcut(key({ key: "K", ctrlKey: true }), false),
		).toBe(true);
	});

	it("ignores other keys and extra modifiers", () => {
		expect(isCommandPaletteShortcut(key({}), false)).toBe(false);
		expect(
			isCommandPaletteShortcut(key({ ctrlKey: true, shiftKey: true }), false),
		).toBe(false);
		expect(
			isCommandPaletteShortcut(key({ key: "j", ctrlKey: true }), false),
		).toBe(false);
	});
});

describe("shortcut display", () => {
	it("shows ⌘ on a Mac and Ctrl elsewhere", () => {
		expect(shortcutKeys(["Mod", "Shift", "O"], true)).toEqual(["⌘", "⇧", "O"]);
		expect(shortcutLabel(["Mod", "K"], true)).toBe("⌘K");
		expect(shortcutLabel(["Mod", "K"], false)).toBe("Ctrl+K");
	});

	it("tells Apple platforms apart", () => {
		expect(isApplePlatform({ platform: "MacIntel" })).toBe(true);
		expect(isApplePlatform({ platform: "Win32" })).toBe(false);
		expect(isApplePlatform({ platform: "", userAgent: "iPhone" })).toBe(true);
	});
});
