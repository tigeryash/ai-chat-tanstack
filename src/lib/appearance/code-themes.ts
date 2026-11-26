import type { PresetId } from "./preset-ids";

// Code highlighting colors (roadmap R2 S9): a pair of Shiki themes, one for light and one for dark,
// handed to Streamdown's `shikiTheme`. The themes ship with Shiki and load with the first code block.

export const CODE_THEME_IDS = [
	"auto",
	"github",
	"one",
	"catppuccin",
	"solarized",
	"vitesse",
] as const;
export type CodeThemeId = (typeof CODE_THEME_IDS)[number];

/** Shiki theme names, light then dark. */
export type ShikiThemePair = readonly [light: string, dark: string];

export const CODE_THEME_LABELS: Record<CodeThemeId, string> = {
	auto: "Follow the theme",
	github: "GitHub",
	one: "One",
	catppuccin: "Catppuccin",
	solarized: "Solarized",
	vitesse: "Vitesse",
};

const PAIRS: Record<Exclude<CodeThemeId, "auto">, ShikiThemePair> = {
	github: ["github-light", "github-dark"],
	one: ["one-light", "one-dark-pro"],
	catppuccin: ["catppuccin-latte", "catppuccin-mocha"],
	solarized: ["solarized-light", "solarized-dark"],
	vitesse: ["vitesse-light", "vitesse-dark"],
};

/** What "Follow the theme" picks for each preset. */
const PRESET_PAIRS: Record<PresetId, ShikiThemePair> = {
	default: PAIRS.github,
	"high-contrast": ["github-light-high-contrast", "github-dark-high-contrast"],
	brand: PAIRS.github,
	paper: PAIRS.solarized,
	nord: ["github-light", "nord"],
	dracula: ["github-light", "dracula"],
};

export function shikiThemes(settings: {
	codeTheme: CodeThemeId;
	preset: PresetId;
}): ShikiThemePair {
	return settings.codeTheme === "auto"
		? PRESET_PAIRS[settings.preset]
		: PAIRS[settings.codeTheme];
}
