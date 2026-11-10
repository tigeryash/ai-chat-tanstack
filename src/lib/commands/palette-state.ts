import { useSyncExternalStore } from "react";

// Whether the command palette is open (roadmap R2 S5), shared by the Cmd+K listener, the sidebar's
// button and the palette. Opening remembers where focus was, so closing can put focus (and the cursor
// in a text field, like the composer's) back. Small on purpose: it's in the dashboard shell.

let open = false;
let returnTo: Element | null = null;
const listeners = new Set<() => void>();

function notify() {
	for (const listener of listeners) listener();
}

export function openCommandPalette(): void {
	if (open) return;
	returnTo = document.activeElement;
	open = true;
	notify();
}

export function closeCommandPalette(): void {
	if (!open) return;
	open = false;
	notify();
}

export function useCommandPaletteOpen(): boolean {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		() => open,
		() => false,
	);
}

/** What had focus when the palette opened. */
export function paletteOpenedFrom(): Element | null {
	return returnTo;
}
