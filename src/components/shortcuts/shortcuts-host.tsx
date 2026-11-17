import { useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { pressedShortcut, type ShortcutId } from "@/lib/commands/keymap";
import { openCommandPalette } from "@/lib/commands/palette-state";
import { PANE_COMMAND_IDS } from "@/lib/commands/pane-command-ids";
import { isTypingTarget } from "@/lib/commands/shortcut";
import {
	setShortcutSheetOpen,
	useShortcutSheetOpen,
} from "@/lib/commands/shortcut-sheet-state";
import {
	addPaneToFocused,
	focusComposer,
	focusedPane,
	focusPaneAt,
	removeFocusedPane,
} from "@/lib/workspaces/focused-pane";

// The keyboard shortcuts (roadmap R2 S6) from `src/lib/commands/keymap.ts`. Cmd+K, Cmd+, and Cmd+B have
// their own listeners (the palette host, the Settings host, the sidebar). The sheet loads on first open.
const ShortcutSheet = lazy(() =>
	import("./shortcut-sheet").then((module) => ({
		default: module.ShortcutSheet,
	})),
);

/** Handled elsewhere: the command palette, Settings and the sidebar listen for their own. */
const OWN_LISTENERS: ReadonlySet<ShortcutId> = new Set([
	"command-palette",
	"open-settings",
	"toggle-sidebar",
]);

/** Runs a shortcut; false when it had nothing to act on here, so the key keeps its usual meaning. */
function runShortcut(
	id: ShortcutId,
	pane: number | undefined,
	newChat: () => void,
	sheetOpen: boolean,
): boolean {
	switch (id) {
		case "show-shortcuts":
			setShortcutSheetOpen(!sheetOpen);
			return true;
		case "new-chat":
			newChat();
			return true;
		// The palette's pane actions (R2 S7): the same code its rows run. "Switch model…" is a palette
		// page, so its shortcut opens the palette there.
		case PANE_COMMAND_IDS.switchModel:
			if (!focusedPane()) return false;
			openCommandPalette(PANE_COMMAND_IDS.switchModel);
			return true;
		case PANE_COMMAND_IDS.add:
			return addPaneToFocused();
		case PANE_COMMAND_IDS.remove:
			return removeFocusedPane();
		case "focus-composer":
			return focusComposer();
		case "focus-pane":
			return focusPaneAt(pane ?? 0);
		default:
			return false;
	}
}

export function ShortcutsHost() {
	const navigate = useNavigate();
	const open = useShortcutSheetOpen();
	// Stays mounted after the first open, so closing plays its exit and returns focus.
	const [loaded, setLoaded] = useState(false);
	if (open && !loaded) setLoaded(true);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const pressed = pressedShortcut(event);
			if (!pressed || OWN_LISTENERS.has(pressed.binding.id)) return;
			const { binding } = pressed;
			// Keys with ⌘, Ctrl or Alt type nothing, so they work in a text field; `?` types itself.
			if (isTypingTarget(event.target) && !pressed.inFields) return;
			// Nothing reaches the page under a dialog (Settings, the palette); the sheet's own key closes it.
			const inDialog =
				event.target instanceof Element &&
				event.target.closest("[role=dialog], [role=alertdialog]") !== null;
			if (inDialog && binding.id !== "show-shortcuts") return;
			if (event.repeat) {
				event.preventDefault();
				return;
			}
			const ran = runShortcut(
				binding.id,
				pressed.pane,
				() => void navigate({ to: "/new" }),
				open,
			);
			if (ran) event.preventDefault();
		};
		// Capture, so a field that handles its own keys (the composer) can't swallow Shift+Esc.
		window.addEventListener("keydown", onKeyDown, { capture: true });
		return () => {
			window.removeEventListener("keydown", onKeyDown, { capture: true });
		};
	}, [navigate, open]);

	if (!loaded) return null;
	return (
		<Suspense fallback={null}>
			<ShortcutSheet open={open} />
		</Suspense>
	);
}
