import { describe, expect, it } from "vitest";
import {
	cardsInSection,
	SETTINGS,
	SETTINGS_CARDS,
	searchSettings,
	visibleSettingsSections,
} from "./registry";

const ids = (query: string) => searchSettings(query).map((m) => m.setting.id);

describe("settings registry", () => {
	it("has unique ids, and every row's card is in its section", () => {
		expect(new Set(SETTINGS.map((s) => s.id)).size).toBe(SETTINGS.length);
		for (const setting of SETTINGS) {
			const card = SETTINGS_CARDS.find((c) => c.id === setting.card);
			expect(card?.section).toBe(setting.section);
		}
	});

	it("keeps a card's rows together", () => {
		const order = SETTINGS.map((s) => s.card).filter(
			(card, i, all) => card !== all[i - 1],
		);
		expect(new Set(order).size).toBe(order.length);
	});

	it("shows General plus the sections that have rows", () => {
		expect(visibleSettingsSections().map((s) => s.id)).toEqual([
			"general",
			"appearance",
			"notifications",
			"models",
			"connections",
			"data",
			"privacy",
		]);
		expect(cardsInSection("keyboard")).toEqual([]);
	});
});

describe("settings search", () => {
	it("finds a setting by its label, any case", () => {
		expect(ids("text size")).toEqual(["text-size"]);
		expect(ids("ACCENT")[0]).toBe("accent-color");
	});

	it("finds a setting by a keyword", () => {
		expect(ids("dark mode")).toEqual(["theme"]);
		expect(ids("ollama")).toEqual(["local-endpoints"]);
		expect(ids("sentry")).toEqual(["analytics"]);
		expect(ids("anthropic")).toEqual(["provider-keys"]);
		expect(ids("advanced colors")).toEqual(["advanced-colors"]);
	});

	it("needs every word, in any order", () => {
		expect(ids("size text")).toEqual(["text-size"]);
		expect(ids("text size zebra")).toEqual([]);
	});

	it("puts label matches before keyword matches", () => {
		const fonts = ids("font");
		expect(fonts.slice(0, 3)).toEqual(["ui-font", "reading-font", "code-font"]);
		expect(ids("notify")).toEqual(["notify-finished", "notify-failed"]);
	});

	it("says which section a result is in", () => {
		const [match] = searchSettings("export data");
		expect(match?.setting.id).toBe("export-import");
		expect(match?.section.label).toBe("Your data");
	});

	it("matches nothing for no query or no match", () => {
		expect(searchSettings("")).toEqual([]);
		expect(searchSettings("   ")).toEqual([]);
		expect(searchSettings("quantum teleport")).toEqual([]);
	});
});
