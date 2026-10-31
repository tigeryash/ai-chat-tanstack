import { z } from "@/lib/zod";
import { HEX_COLOR } from "./color";
import { CODE_FONTS, fontIds, READING_FONTS, UI_FONTS } from "./fonts";
import { COLOR_TOKEN_NAMES } from "./tokens";

// Appearance settings (roadmap 3.11), kept in this browser (synced in Phase 6). Every field only
// overrides tokens from src/styles.css; the defaults below are the 3.0b look (direction A).

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const DENSITIES = ["compact", "comfortable"] as const;
export type Density = (typeof DENSITIES)[number];

/** Text size steps, as a share of the browser's default size. */
export const TEXT_SCALES = [0.875, 0.9375, 1, 1.0625, 1.125, 1.1875, 1.25];

/** Colors are stored as `#rrggbb`, what `<input type="color">` gives. */
const hexColor = z.string().regex(HEX_COLOR);

// Tokens Settings once offered that are gone: the composer's, since it went back to its own colors
// (CLAUDE.md hard rule 8). A saved override of one is dropped, so it doesn't reset every other setting.
const RETIRED_TOKENS = new Set([
	"composer",
	"composer-foreground",
	"composer-border",
]);

const withoutRetiredTokens = (value: unknown) =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? Object.fromEntries(
				Object.entries(value).filter(([name]) => !RETIRED_TOKENS.has(name)),
			)
		: value;

const colorOverrides = z.preprocess(
	withoutRetiredTokens,
	z.partialRecord(z.enum(COLOR_TOKEN_NAMES), hexColor),
);

export const appearanceSchema = z.object({
	version: z.literal(1),
	theme: z.enum(THEMES),
	uiFont: z.enum(fontIds(UI_FONTS)),
	readingFont: z.enum(fontIds(READING_FONTS)),
	codeFont: z.enum(fontIds(CODE_FONTS)),
	textScale: z
		.number()
		.refine((scale) => TEXT_SCALES.includes(scale), "Unknown text size"),
	density: z.enum(DENSITIES),
	/** Primary buttons, selection and focus rings, in both themes. Advanced overrides win over it. */
	accent: hexColor.nullable(),
	/** Advanced: per-token colors, separately for each theme. */
	colors: z.object({ light: colorOverrides, dark: colorOverrides }),
});

export type AppearanceSettings = z.infer<typeof appearanceSchema>;

export const DEFAULT_APPEARANCE: AppearanceSettings = {
	version: 1,
	theme: "system",
	uiFont: "default",
	readingFont: "default",
	codeFont: "default",
	textScale: 1,
	density: "comfortable",
	accent: null,
	colors: { light: {}, dark: {} },
};

// Export/import (a theme file). The wrapper says what the file is, so importing another JSON file
// fails with a clear message instead of resetting everything to defaults.
const exportSchema = z.object({
	app: z.literal("high-elo-llms"),
	kind: z.literal("appearance"),
	settings: appearanceSchema,
});

export function exportAppearance(settings: AppearanceSettings): string {
	return JSON.stringify(
		{ app: "high-elo-llms", kind: "appearance", settings },
		null,
		2,
	);
}

export type ImportResult =
	| { ok: true; settings: AppearanceSettings }
	| { ok: false; error: string };

export function importAppearance(text: string): ImportResult {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return { ok: false, error: "That file isn't JSON." };
	}
	const parsed = exportSchema.safeParse(data);
	if (!parsed.success) {
		return {
			ok: false,
			error:
				"That file isn't a High Elo LLMs appearance file, or it's damaged.",
		};
	}
	return { ok: true, settings: parsed.data.settings };
}
