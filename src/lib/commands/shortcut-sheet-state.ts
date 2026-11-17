import { useSyncExternalStore } from "react";

// Whether the keyboard shortcut sheet is open (roadmap R2 S6), shared by the key listener and the
// palette's "Keyboard shortcuts" command. In the dashboard shell, so small on purpose.

let open = false;
const listeners = new Set<() => void>();

export function setShortcutSheetOpen(next: boolean): void {
	if (open === next) return;
	open = next;
	for (const listener of listeners) listener();
}

export function useShortcutSheetOpen(): boolean {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		() => open,
		() => false,
	);
}
