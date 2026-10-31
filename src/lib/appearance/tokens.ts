// Every color token in src/styles.css, grouped for Settings → Appearance → Advanced (roadmap 3.11).
// The light and dark values are copies of the `:root` defaults there (tokens.test.ts fails when they
// drift): an override replaces one side of a token's light-dark() pair and needs the other side, and
// the contrast check needs real colors. A `var(--x)` default follows that token, overrides included.

export const COLOR_GROUPS = [
	"surfaces",
	"text",
	"borders",
	"accents",
	"states",
] as const;
export type ColorGroup = (typeof COLOR_GROUPS)[number];

export const COLOR_GROUP_LABELS: Record<ColorGroup, string> = {
	surfaces: "Surfaces",
	text: "Text",
	borders: "Borders and focus",
	accents: "Accents and charts",
	states: "States",
};

export interface ColorToken {
	/** The custom property without its `--`. */
	name: string;
	group: ColorGroup;
	label: string;
	light: string;
	dark: string;
}

const token = (
	name: string,
	group: ColorGroup,
	label: string,
	light: string,
	dark: string = light,
): ColorToken => ({ name, group, label, light, dark });

export const COLOR_TOKENS = [
	token(
		"background",
		"surfaces",
		"Page background",
		"oklch(0.985 0 0)",
		"oklch(0 0 0)",
	),
	token("card", "surfaces", "Pane cards", "oklch(1 0 0)", "oklch(0.1 0 0)"),
	token(
		"popover",
		"surfaces",
		"Menus and popovers",
		"oklch(1 0 0)",
		"oklch(0.145 0 0)",
	),
	token(
		"secondary",
		"surfaces",
		"Secondary buttons",
		"oklch(0.97 0 0)",
		"oklch(0.205 0 0)",
	),
	token(
		"muted",
		"surfaces",
		"Muted surfaces",
		"oklch(0.96 0 0)",
		"oklch(0.205 0 0)",
	),
	token(
		"accent",
		"surfaces",
		"Hover and selection",
		"oklch(0.95 0 0)",
		"oklch(0.22 0 0)",
	),
	token("sidebar", "surfaces", "Sidebar", "oklch(0.985 0 0)", "oklch(0.1 0 0)"),
	token(
		"sidebar-accent",
		"surfaces",
		"Sidebar hover",
		"oklch(0.94 0 0)",
		"oklch(0.2 0 0)",
	),
	token("composer", "surfaces", "Composer", "var(--card)"),
	token("overlay", "surfaces", "Dialog scrim", "oklch(0 0 0)"),
	token(
		"auth-backdrop",
		"surfaces",
		"Sign-in backdrop",
		"oklch(0.208 0.042 265.755)",
	),

	token("foreground", "text", "Text", "oklch(0.205 0 0)", "oklch(0.94 0 0)"),
	token("card-foreground", "text", "Text on pane cards", "var(--foreground)"),
	token("popover-foreground", "text", "Text in menus", "var(--foreground)"),
	token(
		"secondary-foreground",
		"text",
		"Text on secondary buttons",
		"var(--foreground)",
	),
	token(
		"muted-foreground",
		"text",
		"Muted text",
		"oklch(0.5 0 0)",
		"oklch(0.7 0 0)",
	),
	token(
		"accent-foreground",
		"text",
		"Text on hover and selection",
		"var(--foreground)",
	),
	token(
		"primary-foreground",
		"text",
		"Text on primary buttons",
		"oklch(0.985 0 0)",
		"oklch(0.145 0 0)",
	),
	token("sidebar-foreground", "text", "Sidebar text", "var(--foreground)"),
	token(
		"sidebar-accent-foreground",
		"text",
		"Sidebar hover text",
		"var(--foreground)",
	),
	token(
		"sidebar-primary-foreground",
		"text",
		"Text on sidebar primary",
		"var(--primary-foreground)",
	),
	token("composer-foreground", "text", "Composer text", "var(--foreground)"),
	token("overlay-foreground", "text", "Text on the scrim", "oklch(1 0 0)"),

	token("border", "borders", "Borders", "oklch(0.922 0 0)", "oklch(0.26 0 0)"),
	token(
		"input",
		"borders",
		"Input borders",
		"oklch(0.88 0 0)",
		"oklch(0.3 0 0)",
	),
	token("ring", "borders", "Focus ring", "oklch(0.45 0 0)", "oklch(0.75 0 0)"),
	token(
		"sidebar-border",
		"borders",
		"Sidebar borders",
		"oklch(0.922 0 0)",
		"oklch(0.22 0 0)",
	),
	token("sidebar-ring", "borders", "Sidebar focus ring", "var(--ring)"),
	token("composer-border", "borders", "Composer border", "var(--border)"),

	token("primary", "accents", "Primary", "oklch(0.205 0 0)", "oklch(0.94 0 0)"),
	token("sidebar-primary", "accents", "Sidebar primary", "var(--primary)"),
	token(
		"link",
		"accents",
		"Links",
		"oklch(0.5 0.12 229)",
		"oklch(0.7 0.1375 229)",
	),
	token(
		"chart-1",
		"accents",
		"Chart 1",
		"oklch(0.646 0.222 41.116)",
		"oklch(0.488 0.243 264.376)",
	),
	token(
		"chart-2",
		"accents",
		"Chart 2",
		"oklch(0.6 0.118 184.704)",
		"oklch(0.696 0.17 162.48)",
	),
	token(
		"chart-3",
		"accents",
		"Chart 3",
		"oklch(0.398 0.07 227.392)",
		"oklch(0.769 0.188 70.08)",
	),
	token(
		"chart-4",
		"accents",
		"Chart 4",
		"oklch(0.828 0.189 84.429)",
		"oklch(0.627 0.265 303.9)",
	),
	token(
		"chart-5",
		"accents",
		"Chart 5",
		"oklch(0.769 0.188 70.08)",
		"oklch(0.645 0.246 16.439)",
	),

	token(
		"destructive",
		"states",
		"Errors and delete",
		"oklch(0.55 0.22 27)",
		"oklch(0.704 0.191 22.216)",
	),
	token("destructive-foreground", "states", "Error text", "var(--destructive)"),
	token(
		"success",
		"states",
		"Success",
		"oklch(0.5 0.12 162)",
		"oklch(0.77 0.15 163)",
	),
	token(
		"warning",
		"states",
		"Warnings",
		"oklch(0.5 0.13 50)",
		"oklch(0.83 0.16 84)",
	),
] as const satisfies readonly ColorToken[];

export type ColorTokenName = (typeof COLOR_TOKENS)[number]["name"];

export const COLOR_TOKEN_NAMES = COLOR_TOKENS.map((t) => t.name) as [
	ColorTokenName,
	...ColorTokenName[],
];

export type ColorScheme = "light" | "dark";
