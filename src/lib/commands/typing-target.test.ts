// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isTypingTarget } from "./shortcut";

const make = (html: string) => {
	document.body.innerHTML = html;
	return document.body.firstElementChild;
};

describe("isTypingTarget", () => {
	it("is true in text fields, selects and editable elements", () => {
		expect(isTypingTarget(make("<textarea></textarea>"))).toBe(true);
		expect(isTypingTarget(make("<input>"))).toBe(true);
		expect(isTypingTarget(make('<input type="search">'))).toBe(true);
		expect(isTypingTarget(make("<select></select>"))).toBe(true);
	});

	it("is false on buttons, checkboxes, read-only fields and the page", () => {
		expect(isTypingTarget(make("<button></button>"))).toBe(false);
		expect(isTypingTarget(make('<input type="checkbox">'))).toBe(false);
		expect(isTypingTarget(make("<textarea readonly></textarea>"))).toBe(false);
		expect(isTypingTarget(document.body)).toBe(false);
		expect(isTypingTarget(null)).toBe(false);
	});
});
