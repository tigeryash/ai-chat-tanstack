import type { PresetId } from "./preset-ids";
import { type AppearanceSettings, DEFAULT_APPEARANCE } from "./schema";
import { appearanceSettings } from "./store";
import type { ColorScheme, ColorTokenName } from "./tokens";

// Theme presets (roadmap R2 S9, docs/settings-research.md section 4; the list is Yash's, 2026-11-09).
// A preset is a theme file the app ships: picking one writes its settings, and once any of them is
// edited the settings read as "Custom (from <preset>)". The light/dark/system choice and text size
// stay yours: a preset covers both schemes, and text size is a reading need, not a look. Loaded only
// by Settings → Appearance and the command palette, never on first load (bundle budget).
// presets.test.ts checks every preset against WCAG AA in both schemes.

/** What a preset sets: everything but the theme (light, dark, system) and text size. */
export type PresetSettings = Omit<
	AppearanceSettings,
	"version" | "theme" | "textScale" | "preset"
>;

export interface Preset {
	id: PresetId;
	label: string;
	description: string;
	/** The upstream palette and its license, for ports. */
	credit?: string;
	settings: PresetSettings;
}

type Palette = Partial<Record<ColorTokenName, string>>;

const BASE: PresetSettings = {
	uiFont: DEFAULT_APPEARANCE.uiFont,
	readingFont: DEFAULT_APPEARANCE.readingFont,
	codeFont: DEFAULT_APPEARANCE.codeFont,
	density: DEFAULT_APPEARANCE.density,
	accent: null,
	colors: { light: {}, dark: {} },
	radius: "default",
	readingWidth: "default",
	codeTheme: "auto",
};

const preset = (
	id: PresetId,
	label: string,
	description: string,
	colors: { light: Palette; dark: Palette },
	settings: Partial<PresetSettings> = {},
	credit?: string,
): Preset => ({
	id,
	label,
	description,
	credit,
	settings: { ...BASE, ...settings, colors },
});

export const PRESETS: readonly Preset[] = [
	preset("default", "Default", "Neutral and minimal.", { light: {}, dark: {} }),
	preset(
		"high-contrast",
		"High contrast",
		"Pure black and white, strong lines, AAA text.",
		{
			light: {
				background: "#ffffff",
				card: "#ffffff",
				popover: "#ffffff",
				secondary: "#ebebeb",
				muted: "#ebebeb",
				accent: "#e0e0e0",
				sidebar: "#ffffff",
				"sidebar-accent": "#e0e0e0",
				foreground: "#000000",
				"muted-foreground": "#2e2e2e",
				primary: "#000000",
				"primary-foreground": "#ffffff",
				border: "#000000",
				input: "#000000",
				ring: "#000000",
				"sidebar-border": "#000000",
				link: "#0000c8",
				destructive: "#a00000",
				success: "#005a00",
				warning: "#6b3a00",
			},
			dark: {
				background: "#000000",
				card: "#000000",
				popover: "#0a0a0a",
				secondary: "#1f1f1f",
				muted: "#1a1a1a",
				accent: "#262626",
				sidebar: "#000000",
				"sidebar-accent": "#262626",
				foreground: "#ffffff",
				"muted-foreground": "#d6d6d6",
				primary: "#ffffff",
				"primary-foreground": "#000000",
				border: "#ffffff",
				input: "#ffffff",
				ring: "#ffffff",
				"sidebar-border": "#ffffff",
				link: "#9ccfff",
				destructive: "#ff9090",
				success: "#7ee89c",
				warning: "#ffd670",
			},
		},
		{ uiFont: "atkinson" },
	),
	preset("brand", "Brand", "The landing page's magenta on slate.", {
		light: {
			background: "#f8fafc",
			card: "#ffffff",
			popover: "#ffffff",
			secondary: "#f1f5f9",
			muted: "#f1f5f9",
			accent: "#f6e7ee",
			sidebar: "#f8fafc",
			"sidebar-accent": "#f1e4eb",
			foreground: "#0f172a",
			"muted-foreground": "#475569",
			primary: "#bd285e",
			"primary-foreground": "#ffffff",
			border: "#e2e8f0",
			input: "#cbd5e1",
			ring: "#bd285e",
			"sidebar-border": "#e2e8f0",
			link: "#0e7490",
		},
		dark: {
			background: "#020617",
			card: "#0f172a",
			popover: "#111c33",
			secondary: "#1e293b",
			muted: "#1e293b",
			accent: "#2a1b2f",
			sidebar: "#0b1222",
			"sidebar-accent": "#1e293b",
			foreground: "#f1f5f9",
			"muted-foreground": "#9aa8bc",
			primary: "#e05a8f",
			"primary-foreground": "#020617",
			border: "#1e293b",
			input: "#334155",
			ring: "#e05a8f",
			"sidebar-border": "#1e293b",
			link: "#38c6e0",
		},
	}),
	preset(
		"paper",
		"Paper",
		"Warm paper, sepia lines and serif replies, for long reading.",
		{
			light: {
				background: "#f8f5ef",
				card: "#fffdf8",
				popover: "#fffdf8",
				secondary: "#efe9df",
				muted: "#efe9df",
				accent: "#e9e2d5",
				sidebar: "#f3eee6",
				"sidebar-accent": "#e9e2d5",
				foreground: "#1f1b17",
				"muted-foreground": "#5f574f",
				primary: "#93292b",
				"primary-foreground": "#fffdf8",
				border: "#e0d6c6",
				input: "#d3c7b4",
				ring: "#93292b",
				"sidebar-border": "#e0d6c6",
				link: "#7c3a10",
			},
			dark: {
				background: "#1d1a17",
				card: "#24201c",
				popover: "#2a2521",
				secondary: "#332d28",
				muted: "#2e2924",
				accent: "#38312b",
				sidebar: "#181513",
				"sidebar-accent": "#332d28",
				foreground: "#ece6da",
				"muted-foreground": "#aea493",
				primary: "#e0906a",
				"primary-foreground": "#1d1a17",
				border: "#3a332c",
				input: "#4a4138",
				ring: "#e0906a",
				"sidebar-border": "#2e2924",
				link: "#e8a87c",
			},
		},
		{ readingFont: "source-serif", density: "comfortable" },
	),
	preset(
		"nord",
		"Nord-style",
		"Cool arctic blues.",
		{
			light: {
				background: "#eceff4",
				card: "#f8f9fb",
				popover: "#ffffff",
				secondary: "#e5e9f0",
				muted: "#e5e9f0",
				accent: "#d8dee9",
				sidebar: "#e5e9f0",
				"sidebar-accent": "#d8dee9",
				foreground: "#2e3440",
				"muted-foreground": "#4c566a",
				primary: "#4a6a95",
				"primary-foreground": "#ffffff",
				border: "#d8dee9",
				input: "#c2cad8",
				ring: "#5e81ac",
				"sidebar-border": "#d8dee9",
				link: "#3f6290",
				destructive: "#a3434c",
				success: "#4a7337",
				warning: "#835c00",
			},
			dark: {
				background: "#2e3440",
				card: "#3b4252",
				popover: "#434c5e",
				secondary: "#434c5e",
				muted: "#434c5e",
				accent: "#434c5e",
				sidebar: "#2e3440",
				"sidebar-accent": "#3b4252",
				foreground: "#eceff4",
				"muted-foreground": "#c3cad6",
				primary: "#88c0d0",
				"primary-foreground": "#2e3440",
				border: "#434c5e",
				input: "#4c566a",
				ring: "#88c0d0",
				"sidebar-border": "#3b4252",
				link: "#88c0d0",
				destructive: "#eba0a6",
				success: "#b4cf9c",
				warning: "#ebcb8b",
			},
		},
		{},
		"Nord by Arctic Ice Studio, MIT license",
	),
	preset(
		"dracula",
		"Dracula-style",
		"Purple and pink on dark; Alucard in light.",
		{
			light: {
				background: "#fffbeb",
				card: "#fffdf5",
				popover: "#ffffff",
				secondary: "#efe8cf",
				muted: "#f0ead6",
				accent: "#ebe3c6",
				sidebar: "#f8f3e0",
				"sidebar-accent": "#ebe3c6",
				foreground: "#1f1f1f",
				"muted-foreground": "#635d43",
				primary: "#644ac9",
				"primary-foreground": "#ffffff",
				border: "#e3dbbd",
				input: "#d4cba8",
				ring: "#644ac9",
				"sidebar-border": "#e3dbbd",
				link: "#036a96",
				destructive: "#b3261e",
				success: "#14710a",
				warning: "#7a6512",
			},
			dark: {
				background: "#21222c",
				card: "#282a36",
				popover: "#343746",
				secondary: "#44475a",
				muted: "#343746",
				accent: "#44475a",
				sidebar: "#21222c",
				"sidebar-accent": "#343746",
				foreground: "#f8f8f2",
				"muted-foreground": "#b8bdd6",
				primary: "#bd93f9",
				"primary-foreground": "#21222c",
				border: "#44475a",
				input: "#565970",
				ring: "#bd93f9",
				"sidebar-border": "#343746",
				link: "#8be9fd",
				destructive: "#ff7a7a",
				success: "#50fa7b",
				warning: "#f1fa8c",
			},
		},
		{},
		"Dracula and Alucard by Zeno Rocha and contributors, MIT license",
	),
];

const PRESETS_BY_ID = new Map(PRESETS.map((p) => [p.id, p]));

export function presetById(id: PresetId): Preset {
	const found = PRESETS_BY_ID.get(id);
	if (!found) throw new Error(`Unknown preset ${id}`);
	return found;
}

/** `current` with the preset's settings, keeping its theme and text size. */
export function withPreset(
	current: AppearanceSettings,
	id: PresetId,
): AppearanceSettings {
	return { ...current, ...presetById(id).settings, preset: id };
}

/** Whether `settings` still match their preset exactly; once anything differs they're "Custom". */
export function matchesPreset(settings: AppearanceSettings): boolean {
	const { settings: wanted } = presetById(settings.preset);
	return (Object.keys(wanted) as (keyof PresetSettings)[]).every((key) =>
		key === "colors"
			? sameColors(settings.colors, wanted.colors)
			: settings[key] === wanted[key],
	);
}

function sameColors(
	a: PresetSettings["colors"],
	b: PresetSettings["colors"],
): boolean {
	return (["light", "dark"] as ColorScheme[]).every((scheme) => {
		const left = a[scheme] as Palette;
		const right = b[scheme] as Palette;
		const names = new Set([...Object.keys(left), ...Object.keys(right)]);
		return [...names].every(
			(name) =>
				left[name as ColorTokenName]?.toLowerCase() ===
				right[name as ColorTokenName]?.toLowerCase(),
		);
	});
}

/** "Paper", or "Custom (from Paper)" once edited. */
export function presetLabel(settings: AppearanceSettings): string {
	const { label } = presetById(settings.preset);
	return matchesPreset(settings) ? label : `Custom (from ${label})`;
}

/** Picks a preset, keeping the theme and text size. */
export function applyPreset(id: PresetId): void {
	appearanceSettings.write(withPreset(appearanceSettings.read(), id));
}
