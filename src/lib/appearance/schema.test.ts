import { describe, expect, it } from "vitest";
import {
	appearanceSchema,
	DEFAULT_APPEARANCE,
	exportAppearance,
	importAppearance,
} from "./schema";

describe("appearanceSchema", () => {
	it("accepts the defaults and a customized theme", () => {
		expect(appearanceSchema.parse(DEFAULT_APPEARANCE)).toEqual(
			DEFAULT_APPEARANCE,
		);
		const custom = {
			...DEFAULT_APPEARANCE,
			theme: "light",
			uiFont: "inter",
			readingFont: "source-serif",
			codeFont: "jetbrains-mono",
			textScale: 1.125,
			density: "compact",
			accent: "#3366cc",
			colors: { light: { background: "#fafafa" }, dark: {} },
		};
		expect(appearanceSchema.safeParse(custom).success).toBe(true);
	});

	it("drops overrides of retired tokens and keeps the rest", () => {
		const saved = {
			...DEFAULT_APPEARANCE,
			theme: "light",
			colors: {
				light: { composer: "#ffffff", background: "#fafafa" },
				dark: { "composer-foreground": "#000000" },
			},
		};
		expect(appearanceSchema.parse(saved)).toEqual({
			...DEFAULT_APPEARANCE,
			theme: "light",
			colors: { light: { background: "#fafafa" }, dark: {} },
		});
	});

	it.each([
		["an unknown theme", { theme: "sepia" }],
		["an unknown font", { uiFont: "comic-sans" }],
		["a code font as the UI font", { uiFont: "jetbrains-mono" }],
		["an off-scale text size", { textScale: 3 }],
		["a non-hex accent", { accent: "red" }],
		[
			"a CSS injection in a color",
			{ colors: { light: { card: "#fff;}*{" }, dark: {} } },
		],
		[
			"an unknown token",
			{ colors: { light: { "made-up": "#ffffff" }, dark: {} } },
		],
		["a newer version", { version: 2 }],
	])("rejects %s", (_name, patch) => {
		expect(
			appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, ...patch }).success,
		).toBe(false);
	});
});

describe("export and import", () => {
	it("round-trips", () => {
		const settings = {
			...DEFAULT_APPEARANCE,
			theme: "dark" as const,
			accent: "#ff8800",
		};
		expect(importAppearance(exportAppearance(settings))).toEqual({
			ok: true,
			settings,
		});
	});

	it("explains what's wrong with a bad file", () => {
		expect(importAppearance("not json")).toEqual({
			ok: false,
			error: "That file isn't JSON.",
		});
		const other = importAppearance(JSON.stringify({ chats: [] }));
		expect(other.ok).toBe(false);
		const broken = importAppearance(
			JSON.stringify({
				app: "high-elo-llms",
				kind: "appearance",
				settings: { ...DEFAULT_APPEARANCE, theme: "neon" },
			}),
		);
		expect(broken.ok).toBe(false);
	});
});
