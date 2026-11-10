// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useIsMobile } from "./use-mobile";

const originalMatchMedia = window.matchMedia;

// jsdom has no matchMedia. This stand-in answers every query with one viewport and can resize it.
function fakeViewport(phone: boolean) {
	const listeners = new Set<() => void>();
	let matches = phone;
	window.matchMedia = () =>
		({
			get matches() {
				return matches;
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

afterEach(() => {
	window.matchMedia = originalMatchMedia;
});

describe("useIsMobile", () => {
	it("is right on the first render, so phone panes mount once (quality audit Q2 W5)", () => {
		fakeViewport(true);
		const renders: boolean[] = [];
		renderHook(() => {
			const mobile = useIsMobile();
			renders.push(mobile);
			return mobile;
		});
		expect(renders.every(Boolean)).toBe(true);
	});

	it("follows the viewport", () => {
		const viewport = fakeViewport(false);
		const { result } = renderHook(() => useIsMobile());
		expect(result.current).toBe(false);
		act(() => viewport.set(true));
		expect(result.current).toBe(true);
	});
});
