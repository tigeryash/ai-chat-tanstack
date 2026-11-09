import { describe, expect, it } from "vitest";
import {
	SWIPE_MIN_DISTANCE,
	steppedIndex,
	swipeStep,
	tabIndexForKey,
} from "./pane-tabs";

const origin = { x: 200, y: 300 };

describe("swipeStep", () => {
	it("goes to the next pane on a swipe left and the previous one on a swipe right", () => {
		expect(swipeStep(origin, { x: 200 - SWIPE_MIN_DISTANCE, y: 300 })).toBe(1);
		expect(swipeStep(origin, { x: 200 + 120, y: 310 })).toBe(-1);
	});

	it("ignores taps and short drags", () => {
		expect(swipeStep(origin, origin)).toBe(0);
		expect(swipeStep(origin, { x: 200 - SWIPE_MIN_DISTANCE + 1, y: 300 })).toBe(
			0,
		);
	});

	it("ignores mostly vertical movement, so scrolling never switches panes", () => {
		expect(swipeStep(origin, { x: 120, y: 500 })).toBe(0);
		expect(swipeStep(origin, { x: 100, y: 351 })).toBe(0);
		expect(swipeStep(origin, { x: 100, y: 349 })).toBe(1);
	});
});

describe("tabIndexForKey", () => {
	it("moves with the arrows and wraps at the ends", () => {
		expect(tabIndexForKey("ArrowRight", 0, 3)).toBe(1);
		expect(tabIndexForKey("ArrowRight", 2, 3)).toBe(0);
		expect(tabIndexForKey("ArrowLeft", 0, 3)).toBe(2);
		expect(tabIndexForKey("ArrowLeft", 2, 3)).toBe(1);
	});

	it("jumps to the ends with Home and End", () => {
		expect(tabIndexForKey("Home", 2, 3)).toBe(0);
		expect(tabIndexForKey("End", 0, 3)).toBe(2);
	});

	it("ignores other keys and empty rows", () => {
		expect(tabIndexForKey("Enter", 1, 3)).toBeUndefined();
		expect(tabIndexForKey("ArrowDown", 1, 3)).toBeUndefined();
		expect(tabIndexForKey("ArrowRight", 0, 0)).toBeUndefined();
	});
});

describe("steppedIndex", () => {
	it("steps within the panes and stops at either end", () => {
		expect(steppedIndex(0, 1, 3)).toBe(1);
		expect(steppedIndex(2, -1, 3)).toBe(1);
		expect(steppedIndex(2, 1, 3)).toBeUndefined();
		expect(steppedIndex(0, -1, 3)).toBeUndefined();
		expect(steppedIndex(1, 0, 3)).toBeUndefined();
	});
});
