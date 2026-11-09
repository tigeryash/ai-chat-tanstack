import { type TouchEvent, useRef } from "react";
import { type Point, swipeStep } from "./pane-tabs";

/**
 * Whether a swipe that starts on `target` belongs to something else: a text field (moving the caret)
 * or anything that scrolls sideways itself (a wide code block or table) up to `root`.
 */
function ownsSideways(target: EventTarget | null, root: Element): boolean {
	for (
		let element = target instanceof Element ? target : null;
		element && element !== root;
		element = element.parentElement
	) {
		if (element.matches("input, textarea, [contenteditable=true]")) return true;
		if (element.scrollWidth > element.clientWidth) {
			const { overflowX } = getComputedStyle(element);
			if (overflowX === "auto" || overflowX === "scroll") return true;
		}
	}
	return false;
}

/**
 * Touch handlers that call `onStep(1)` on a swipe left and `onStep(-1)` on a swipe right (roadmap 3.8).
 * Listens passively and never prevents scrolling: the swipe is read when the finger lifts, and only
 * a clearly sideways one counts (`swipeStep`).
 */
export function usePaneSwipe(onStep: (step: -1 | 1) => void) {
	const start = useRef<Point | null>(null);
	return {
		onTouchStart: (event: TouchEvent<HTMLElement>) => {
			const touch = event.touches[0];
			start.current =
				event.touches.length === 1 &&
				touch &&
				!ownsSideways(event.target, event.currentTarget)
					? { x: touch.clientX, y: touch.clientY }
					: null;
		},
		onTouchEnd: (event: TouchEvent<HTMLElement>) => {
			const from = start.current;
			const touch = event.changedTouches[0];
			start.current = null;
			if (!from || !touch || event.touches.length > 0) return;
			const step = swipeStep(from, { x: touch.clientX, y: touch.clientY });
			if (step !== 0) onStep(step);
		},
		onTouchCancel: () => {
			start.current = null;
		},
	};
}
