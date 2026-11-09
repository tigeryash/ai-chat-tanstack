// Narrow screens (roadmap 3.8): one pane shows at a time, picked from a row of tabs or by swiping.
// These are the pure decisions; `pane-tabs.tsx` and `use-pane-swipe.ts` wire them to the page.

/** How far (px) a finger has to travel sideways before a swipe switches panes. */
export const SWIPE_MIN_DISTANCE = 56;

/** A swipe has to be at least this much more sideways than vertical, so scrolling never switches. */
const SWIPE_SIDEWAYS_RATIO = 2;

export interface Point {
	x: number;
	y: number;
}

/**
 * The pane step a finger moving from `start` to `end` asks for: 1 for the next pane (swiping left),
 * -1 for the previous one, 0 for a tap, a scroll, or a short drag.
 */
export function swipeStep(start: Point, end: Point): -1 | 0 | 1 {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return 0;
	if (Math.abs(dx) < Math.abs(dy) * SWIPE_SIDEWAYS_RATIO) return 0;
	return dx < 0 ? 1 : -1;
}

/**
 * The tab a key moves to in a tab row of `count` tabs (WAI-ARIA tabs pattern): the arrows wrap,
 * Home and End jump to the ends. Undefined for any other key.
 */
export function tabIndexForKey(
	key: string,
	index: number,
	count: number,
): number | undefined {
	if (count === 0) return undefined;
	if (key === "ArrowRight") return (index + 1) % count;
	if (key === "ArrowLeft") return (index - 1 + count) % count;
	if (key === "Home") return 0;
	if (key === "End") return count - 1;
	return undefined;
}

/** The pane index a step lands on, or undefined past either end (swipes don't wrap). */
export function steppedIndex(
	index: number,
	step: -1 | 0 | 1,
	count: number,
): number | undefined {
	const next = index + step;
	if (step === 0 || next < 0 || next >= count) return undefined;
	return next;
}
