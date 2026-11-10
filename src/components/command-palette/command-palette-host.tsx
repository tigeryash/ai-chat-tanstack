import { lazy, Suspense, useEffect, useState } from "react";
import {
	closeCommandPalette,
	openCommandPalette,
	useCommandPaletteOpen,
} from "@/lib/commands/palette-state";
import { isCommandPaletteShortcut } from "@/lib/commands/shortcut";

// The command palette (roadmap R2 S5) loads on first open: its dialog, search and chat list stay out of
// the shell's first load (bundle budget). Only this listener and the sidebar's button are in the shell.
const CommandPalette = lazy(() =>
	import("./command-palette").then((module) => ({
		default: module.CommandPalette,
	})),
);

/** Fetches the palette's code early, when a pointer heads for its button. */
export function preloadCommandPalette(): void {
	void import("./command-palette");
}

function settingsInUrl(): boolean {
	return new URLSearchParams(window.location.search).has("settings");
}

/** Opens the palette on Cmd+K (Ctrl+K off a Mac), even while typing in the composer. */
export function CommandPaletteHost() {
	const open = useCommandPaletteOpen();
	// Stays mounted after the first open, so closing plays its exit and returns focus.
	const [loaded, setLoaded] = useState(false);
	if (open && !loaded) setLoaded(true);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!isCommandPaletteShortcut(event)) return;
			event.preventDefault();
			if (event.repeat) return;
			if (open) closeCommandPalette();
			// Settings is its own dialog (`?settings=`); the palette doesn't open over it. Read from the
			// URL here rather than the router, which keeps the shell's chunks as they were (bundle budget).
			else if (!settingsInUrl()) openCommandPalette();
		};
		// Capture, so a field that handles its own keys (the composer) can't swallow the shortcut.
		window.addEventListener("keydown", onKeyDown, { capture: true });
		return () =>
			window.removeEventListener("keydown", onKeyDown, { capture: true });
	}, [open]);

	if (!loaded) return null;
	return (
		<Suspense fallback={null}>
			<CommandPalette open={open} />
		</Suspense>
	);
}
