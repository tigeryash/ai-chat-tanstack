import { describe, expect, it } from "vitest";
import { contrastWarnings } from "./contrast";
import { DEFAULT_APPEARANCE } from "./schema";

describe("contrastWarnings", () => {
	it("passes the default theme in both schemes", () => {
		expect(contrastWarnings(DEFAULT_APPEARANCE, "light")).toEqual([]);
		expect(contrastWarnings(DEFAULT_APPEARANCE, "dark")).toEqual([]);
	});

	it("flags a text color too close to its background, in that scheme only", () => {
		const settings = {
			...DEFAULT_APPEARANCE,
			colors: { light: { foreground: "#eeeeee" }, dark: {} },
		};
		const warnings = contrastWarnings(settings, "light");
		// foreground also feeds card-, popover-, secondary-, accent-, sidebar- and composer-foreground.
		expect(warnings.map((w) => `${w.text}/${w.background}`)).toContain(
			"foreground/background",
		);
		expect(warnings.map((w) => w.text)).toContain("card-foreground");
		expect(warnings.every((w) => w.ratio < 4.5 && w.scheme === "light")).toBe(
			true,
		);
		expect(contrastWarnings(settings, "dark")).toEqual([]);
	});

	it("keeps the accent's text readable by picking dark or light text", () => {
		for (const accent of ["#ffeb3b", "#1a237e", "#00bcd4", "#e91e63"]) {
			const settings = { ...DEFAULT_APPEARANCE, accent };
			for (const scheme of ["light", "dark"] as const) {
				const onAccent = contrastWarnings(settings, scheme).filter(
					(w) =>
						w.background === "primary" || w.background === "sidebar-primary",
				);
				expect(onAccent).toEqual([]);
			}
		}
	});
});
