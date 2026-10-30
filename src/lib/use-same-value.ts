import { useState } from "react";

/** Equal when both serialize the same: for small plain objects built in the same key order. */
export const sameJson = (a: unknown, b: unknown) =>
	JSON.stringify(a) === JSON.stringify(b);

/**
 * `value`, but keeping the last one's identity while it's equal (by `isEqual`). For objects rebuilt
 * every render, like a chat's model selection, so memoized children (each finished message) don't
 * re-render for a copy of what they already have.
 */
export function useSameValue<T>(
	value: T,
	isEqual: (a: T, b: T) => boolean = sameJson,
): T {
	const [kept, setKept] = useState(value);
	if (kept === value || isEqual(kept, value)) return kept;
	// Adjusting state while rendering (React's "storing information from previous renders").
	setKept(value);
	return value;
}
