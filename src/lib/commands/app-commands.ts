import { setAnalyticsEnabled } from "@/lib/analytics/consent";
import {
	DENSITIES,
	type Density,
	THEMES,
	type Theme,
} from "@/lib/appearance/schema";
import { updateAppearance } from "@/lib/appearance/store";
import type { Command } from "./command";
import { shortcutOf } from "./keymap";

// The app's fixed commands (roadmap R2 S5): actions, and the quick toggles that flip a setting right in
// the palette. Their ids are stable slugs: recency stores them and `command_run` sends them.

export const ACTION_COMMANDS: readonly Command[] = [
	{
		id: "new-chat",
		title: "New chat",
		keywords: ["create", "start", "conversation"],
		group: "actions",
		shortcut: shortcutOf("new-chat"),
		run: (env) => env.goTo("/new"),
	},
	{
		id: "go-prompts",
		title: "Go to Prompts",
		keywords: ["prompt library", "saved prompts", "system prompt"],
		group: "actions",
		when: ({ pathname }) => pathname !== "/prompts",
		run: (env) => env.goTo("/prompts"),
	},
	{
		id: "open-settings",
		title: "Open Settings",
		keywords: ["preferences", "options", "configure"],
		group: "actions",
		shortcut: shortcutOf("open-settings"),
		run: (env) => env.openSettings("general"),
	},
	{
		id: "toggle-sidebar",
		title: "Toggle sidebar",
		keywords: ["hide sidebar", "show sidebar", "chat list"],
		group: "actions",
		shortcut: shortcutOf("toggle-sidebar"),
		run: (env) => env.toggleSidebar(),
	},
	{
		id: "show-shortcuts",
		title: "Keyboard shortcuts",
		keywords: ["keys", "hotkeys", "keybindings", "help"],
		group: "actions",
		shortcut: shortcutOf("show-shortcuts"),
		run: (env) => env.showShortcuts(),
	},
];

/** What the quick toggles show as on. `analytics` is null when the browser opts out (GPC or DNT). */
export interface ToggleState {
	theme: Theme;
	density: Density;
	analytics: boolean | null;
}

const THEME_NAMES: Record<Theme, string> = {
	system: "System",
	light: "Light",
	dark: "Dark",
};

const DENSITY_NAMES: Record<Density, string> = {
	compact: "Compact",
	comfortable: "Comfortable",
};

/** One toggle per theme, `searchOnly` in the main list and listed in full on "Switch theme…". */
function themeCommands(current: Theme, searchOnly: boolean): Command[] {
	return THEMES.map(
		(theme): Command => ({
			id: `theme-${theme}`,
			title: `Theme: ${THEME_NAMES[theme]}`,
			keywords: ["appearance", "color scheme", "mode", `${theme} mode`],
			group: "settings",
			checked: current === theme,
			searchOnly,
			run: () => updateAppearance({ theme }),
		}),
	);
}

/**
 * "Switch theme…" (roadmap R2 S7): a nested page with the themes. The presets join it when S9 adds
 * them.
 */
export function switchThemeCommand(current: Theme): Command {
	return {
		id: "switch-theme",
		title: "Switch theme…",
		detail: THEME_NAMES[current],
		keywords: [
			"appearance",
			"color scheme",
			"dark mode",
			"light mode",
			"preset",
		],
		group: "actions",
		opens: {
			title: "Switch theme",
			placeholder: "Search themes…",
			empty: "No themes match.",
			commands: () => themeCommands(current, false),
		},
		run: () => {},
	};
}

/** Quick toggles: theme, density and analytics, each with whether it's on now. */
export function toggleCommands(state: ToggleState): Command[] {
	const themes = themeCommands(state.theme, true);
	const densities = DENSITIES.map(
		(density): Command => ({
			id: `density-${density}`,
			title: `Density: ${DENSITY_NAMES[density]}`,
			keywords: ["appearance", "spacing"],
			group: "settings",
			checked: state.density === density,
			searchOnly: true,
			run: () => updateAppearance({ density }),
		}),
	);
	const enabled = state.analytics;
	const analytics: Command[] =
		enabled === null
			? []
			: [
					{
						id: "toggle-analytics",
						title: "Share anonymous usage analytics",
						keywords: ["analytics", "telemetry", "tracking", "privacy"],
						group: "settings",
						checked: enabled,
						searchOnly: true,
						run: () => setAnalyticsEnabled(!enabled),
					},
				];
	return [...themes, ...densities, ...analytics];
}
