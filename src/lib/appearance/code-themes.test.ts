import { describe, expect, it } from "vitest";
import { shikiThemes } from "./code-themes";

describe("shikiThemes", () => {
	it("follows the preset on auto", () => {
		expect(shikiThemes({ codeTheme: "auto", preset: "default" })).toEqual([
			"github-light",
			"github-dark",
		]);
		expect(shikiThemes({ codeTheme: "auto", preset: "dracula" })[1]).toBe(
			"dracula",
		);
	});

	it("uses a picked theme whatever the preset", () => {
		expect(shikiThemes({ codeTheme: "solarized", preset: "nord" })).toEqual([
			"solarized-light",
			"solarized-dark",
		]);
	});
});
