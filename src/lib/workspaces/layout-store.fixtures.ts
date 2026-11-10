import type { SavedLayout, SavedLayoutStore } from "./saved-layouts";

/** Saved layouts in memory, standing in for localStorage in tests. */
export function memoryLayoutStore(
	initial: readonly SavedLayout[] = [],
): SavedLayoutStore {
	let layouts = [...initial];
	return {
		read: () => layouts,
		write: (next) => {
			layouts = [...next];
		},
	};
}
