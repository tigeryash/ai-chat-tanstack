import { describe, expect, it } from "vitest";
import { ACTION_COMMANDS } from "./app-commands";
import { keysOf, pressedShortcut, SHORTCUTS, shortcutBinding } from "./keymap";
import { matchesShortcut } from "./shortcut";

const key = (init: Partial<KeyboardEvent>) => ({
	key: "",
	code: "",
	metaKey: false,
	ctrlKey: false,
	altKey: false,
	shiftKey: false,
	...init,
});

const pressed = (init: Partial<KeyboardEvent>, apple: boolean) => {
	const found = pressedShortcut(key(init), apple);
	return found && { id: found.binding.id, pane: found.pane };
};

describe("pressedShortcut", () => {
	it("uses ⌘ on a Mac and Ctrl elsewhere", () => {
		const newChat = { key: "O", code: "KeyO", shiftKey: true };
		expect(pressed({ ...newChat, metaKey: true }, true)?.id).toBe("new-chat");
		expect(pressed({ ...newChat, ctrlKey: true }, false)?.id).toBe("new-chat");
		expect(pressed({ ...newChat, ctrlKey: true }, true)).toBeNull();
		expect(pressed({ ...newChat, metaKey: true }, false)).toBeNull();
	});

	it("tells ⌘\\ from ⌘⇧\\, though Shift types |", () => {
		const backslash = { key: "\\", code: "Backslash", ctrlKey: true };
		expect(pressed(backslash, false)?.id).toBe("add-pane");
		expect(pressed({ ...backslash, key: "|", shiftKey: true }, false)?.id).toBe(
			"remove-pane",
		);
	});

	it("focuses panes with Ctrl+1–4 on a Mac and Alt+1–4 elsewhere", () => {
		expect(pressed({ key: "2", code: "Digit2", ctrlKey: true }, true)).toEqual({
			id: "focus-pane",
			pane: 1,
		});
		expect(pressed({ key: "4", code: "Digit4", altKey: true }, false)).toEqual({
			id: "focus-pane",
			pane: 3,
		});
		// On a Mac, Alt+digit types a symbol and Ctrl+digit off a Mac switches tabs: neither is ours.
		expect(
			pressed({ key: "¡", code: "Digit1", altKey: true }, true),
		).toBeNull();
		expect(
			pressed({ key: "1", code: "Digit1", ctrlKey: true }, false),
		).toBeNull();
		expect(
			pressed({ key: "5", code: "Digit5", altKey: true }, false),
		).toBeNull();
	});

	it("opens the sheet with ⌘/ or ?, and focuses the composer with Shift+Esc", () => {
		expect(pressed({ key: "/", code: "Slash", metaKey: true }, true)?.id).toBe(
			"show-shortcuts",
		);
		expect(
			pressed({ key: "?", code: "Slash", shiftKey: true }, false)?.id,
		).toBe("show-shortcuts");
		expect(pressed({ key: "Escape", shiftKey: true }, true)?.id).toBe(
			"focus-composer",
		);
		expect(pressed({ key: "Escape" }, true)).toBeNull();
	});
});

describe("the keymap", () => {
	it("has one binding per id, and no two share keys", () => {
		expect(new Set(SHORTCUTS.map((b) => b.id)).size).toBe(SHORTCUTS.length);
		for (const apple of [true, false]) {
			const keys = SHORTCUTS.map((b) => keysOf(b, apple).join("+"));
			expect(new Set(keys).size).toBe(keys.length);
		}
	});

	it("keeps browser-reserved keys free", () => {
		const reserved = ["N", "T", "W", "L", "R", "F", "1", "9"];
		for (const binding of SHORTCUTS) {
			const keys = keysOf(binding, true);
			if (keys.length === 2 && keys[0] === "Mod") {
				expect(reserved).not.toContain(keys[1]);
			}
		}
	});

	it("is where commands get their shortcuts", () => {
		const settings = ACTION_COMMANDS.find((c) => c.id === "open-settings");
		expect(settings?.shortcut).toBe(shortcutBinding("open-settings").keys);
		for (const command of ACTION_COMMANDS) {
			if (!command.shortcut) continue;
			expect(SHORTCUTS.some((b) => b.keys === command.shortcut)).toBe(true);
		}
	});

	it("lets only Cmd+K, Cmd+, and Shift+Esc work while typing", () => {
		expect(
			SHORTCUTS.filter((b) => b.inFields)
				.map((b) => b.id)
				.sort(),
		).toEqual(["command-palette", "focus-composer", "open-settings"]);
	});
});

describe("matchesShortcut", () => {
	it("needs the exact modifiers", () => {
		expect(
			matchesShortcut(key({ key: "b", metaKey: true }), ["Mod", "B"], true),
		).toBe(true);
		expect(
			matchesShortcut(
				key({ key: "b", metaKey: true, shiftKey: true }),
				["Mod", "B"],
				true,
			),
		).toBe(false);
	});
});
