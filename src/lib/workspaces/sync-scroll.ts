import { type RefObject, useEffect } from "react";

// Sync scroll (roadmap 3.4): scrolling one pane's messages scrolls the others to the same place, by
// proportion, since replies of different lengths make pixel offsets meaningless. Off by default; the
// workspace toolbar toggles it for this visit.

/** Each pane's scrolling message list. */
export const PANE_SCROLLER =
	"[data-pane-id] [data-slot='message-scroller-viewport']";

interface ScrollBox {
	scrollTop: number;
	scrollHeight: number;
	clientHeight: number;
}

/** How far down `box` is scrolled, 0 to 1 (0 when it doesn't scroll). */
export function scrollRatio(box: ScrollBox): number {
	const range = box.scrollHeight - box.clientHeight;
	if (range <= 0) return 0;
	return Math.min(1, Math.max(0, box.scrollTop / range));
}

/** The `scrollTop` that puts `box` at `ratio` of the way down. */
export function scrollTopAt(box: ScrollBox, ratio: number): number {
	return Math.round(Math.max(0, box.scrollHeight - box.clientHeight) * ratio);
}

/**
 * While `enabled`, a scroll in one pane under `container` moves the others. Listens in the capture
 * phase on the container, so panes that open later join without re-subscribing.
 */
export function useSyncScroll(
	container: RefObject<HTMLElement | null>,
	enabled: boolean,
) {
	useEffect(() => {
		const root = container.current;
		if (!enabled || !root) return;
		// Where this hook last put each pane: a scroll event that lands there is our own move, not the
		// person's, so it mustn't move the rest back. Kept by position rather than counting events,
		// since several moves can land in one frame.
		const placed = new WeakMap<Element, number>();
		const onScroll = (event: Event) => {
			const source = event.target;
			if (!(source instanceof HTMLElement) || !source.matches(PANE_SCROLLER)) {
				return;
			}
			const expected = placed.get(source);
			placed.delete(source);
			if (expected !== undefined && Math.abs(source.scrollTop - expected) < 1) {
				return;
			}
			const ratio = scrollRatio(source);
			for (const other of root.querySelectorAll<HTMLElement>(PANE_SCROLLER)) {
				if (other === source) continue;
				const top = scrollTopAt(other, ratio);
				if (Math.abs(other.scrollTop - top) < 1) continue;
				other.scrollTop = top;
				placed.set(other, other.scrollTop);
			}
		};
		root.addEventListener("scroll", onScroll, { capture: true, passive: true });
		return () =>
			root.removeEventListener("scroll", onScroll, { capture: true });
	}, [container, enabled]);
}
