import { describe, expect, it } from "vitest";
import { SETTINGS_SECTION_IDS } from "./section-ids";
import {
	parseSettingsSection,
	SETTINGS_SECTIONS,
	sectionForLegacySettingsLink,
	validateSettingsSearch,
} from "./sections";

describe("sections", () => {
	it("has one per id, in the ids' order", () => {
		expect(SETTINGS_SECTIONS.map((s) => s.id)).toEqual([
			...SETTINGS_SECTION_IDS,
		]);
	});
});

describe("?settings= parsing", () => {
	it("is closed without the parameter", () => {
		expect(parseSettingsSection(undefined)).toBeUndefined();
		expect(parseSettingsSection(null)).toBeUndefined();
		expect(validateSettingsSearch({ models: "a" })).toEqual({});
	});

	it("opens a known section, whatever its case", () => {
		expect(parseSettingsSection("appearance")).toBe("appearance");
		expect(parseSettingsSection(" Connections ")).toBe("connections");
		for (const { id } of SETTINGS_SECTIONS) {
			expect(parseSettingsSection(id)).toBe(id);
		}
	});

	it("falls back to General for an unknown or empty section", () => {
		expect(parseSettingsSection("nope")).toBe("general");
		expect(parseSettingsSection("")).toBe("general");
		expect(parseSettingsSection(42)).toBe("general");
		expect(parseSettingsSection("__proto__")).toBe("general");
	});

	it("keeps the page's other parameters out of its result", () => {
		expect(
			validateSettingsSearch({ settings: "privacy", models: "a,b" }),
		).toEqual({ settings: "privacy" });
	});
});

describe("old /settings links", () => {
	it("land on the section their anchor was in", () => {
		expect(sectionForLegacySettingsLink("#provider-keys")).toBe("connections");
		expect(sectionForLegacySettingsLink("appearance")).toBe("appearance");
		expect(sectionForLegacySettingsLink("#your-data")).toBe("data");
		expect(sectionForLegacySettingsLink("#analytics")).toBe("privacy");
	});

	it("land on Connections without a known anchor", () => {
		expect(sectionForLegacySettingsLink("")).toBe("connections");
		expect(sectionForLegacySettingsLink("#whatever")).toBe("connections");
	});
});
