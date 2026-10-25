// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { REDUCED_MOTION, usePrefersReducedMotion } from "./reduced-motion";

const originalMatchMedia = window.matchMedia;

// jsdom has no matchMedia. This stand-in answers the reduced-motion query and can flip it like the OS would.
function fakeOsSetting(reduce: boolean) {
	const listeners = new Set<() => void>();
	let matches = reduce;
	window.matchMedia = (query: string) =>
		({
			get matches() {
				return query === REDUCED_MOTION && matches;
			},
			addEventListener: (_type: string, listener: () => void) =>
				listeners.add(listener),
			removeEventListener: (_type: string, listener: () => void) =>
				listeners.delete(listener),
		}) as unknown as MediaQueryList;

	return {
		set(next: boolean) {
			matches = next;
			for (const listener of listeners) listener();
		},
	};
}

function MotionLabel() {
	return usePrefersReducedMotion() ? "reduce" : "full";
}

afterEach(() => {
	window.matchMedia = originalMatchMedia;
});

describe("usePrefersReducedMotion", () => {
	it("reads the OS setting and follows changes to it", () => {
		const os = fakeOsSetting(true);
		const { result } = renderHook(() => usePrefersReducedMotion());

		expect(result.current).toBe(true);

		act(() => os.set(false));
		expect(result.current).toBe(false);
	});

	it("assumes full motion on the server, so hydration markup matches", () => {
		fakeOsSetting(true);

		expect(renderToString(<MotionLabel />)).toBe("full");
	});
});
