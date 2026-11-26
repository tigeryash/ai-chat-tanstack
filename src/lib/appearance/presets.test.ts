import { describe, expect, it } from "vitest";
import { contrastRatio } from "./color";
import { contrastWarnings } from "./contrast";
import { PRESET_IDS } from "./preset-ids";
import {
	matchesPreset,
	PRESETS,
	presetById,
	presetLabel,
	withPreset,
} from "./presets";
import { appearanceSchema, DEFAULT_APPEARANCE } from "./schema";
import { resolveColor } from "./theme-colors";

describe("theme presets", () => {
	it("has one preset per id, in order", () => {
		expect(PRESETS.map((p) => p.id)).toEqual([...PRESET_IDS]);
	});

	// Text on background, muted text and the primary button are among CONTRAST_PAIRS.
	describe.each(PRESETS)("$label", (preset) => {
		const settings = withPreset(DEFAULT_APPEARANCE, preset.id);

		it("is valid settings", () => {
			expect(appearanceSchema.parse(settings)).toEqual(settings);
		});

		it.each(["light", "dark"] as const)(
			"meets WCAG AA for every text pair in %s",
			(scheme) => {
				expect(contrastWarnings(settings, scheme)).toEqual([]);
			},
		);
	});

	it.each(["light", "dark"] as const)(
		"high contrast meets AAA (7:1) for text and muted text in %s",
		(scheme) => {
			const settings = withPreset(DEFAULT_APPEARANCE, "high-contrast");
			const ratio = (
				text: "foreground" | "muted-foreground",
				bg: "background" | "muted",
			) =>
				contrastRatio(
					resolveColor(settings, scheme, text),
					resolveColor(settings, scheme, bg),
				);
			expect(ratio("foreground", "background")).toBeGreaterThanOrEqual(7);
			expect(ratio("muted-foreground", "muted")).toBeGreaterThanOrEqual(7);
		},
	);

	it("keeps the theme and text size when applied", () => {
		const current = {
			...DEFAULT_APPEARANCE,
			theme: "dark" as const,
			textScale: 1.125,
		};
		const next = withPreset(current, "paper");
		expect(next).toMatchObject({
			theme: "dark",
			textScale: 1.125,
			preset: "paper",
			readingFont: "source-serif",
		});
	});

	it("turns into Custom once edited, and back when the edit is undone", () => {
		const paper = withPreset(DEFAULT_APPEARANCE, "paper");
		expect(matchesPreset(paper)).toBe(true);
		expect(presetLabel(paper)).toBe("Paper");

		const edited = { ...paper, radius: "round" as const };
		expect(presetLabel(edited)).toBe("Custom (from Paper)");
		expect(presetLabel({ ...edited, radius: "default" })).toBe("Paper");

		const recolored = {
			...paper,
			colors: {
				...paper.colors,
				dark: { ...paper.colors.dark, card: "#000000" },
			},
		};
		expect(matchesPreset(recolored)).toBe(false);
	});

	it("reads the defaults as the Default preset", () => {
		expect(presetLabel(DEFAULT_APPEARANCE)).toBe(presetById("default").label);
		expect(presetLabel({ ...DEFAULT_APPEARANCE, accent: "#3366cc" })).toBe(
			"Custom (from Default)",
		);
	});
});
