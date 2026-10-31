// The fonts Settings → Appearance offers (roadmap 3.11). Web fonts are self-hosted from @fontsource
// packages (src/styles/fonts.css declares them), so picking one adds no third-party origin. A font
// file only downloads once a token uses its family. "default" keeps the token's stack in styles.css.

export interface FontOption {
	id: string;
	label: string;
	/** The token's new value; null keeps styles.css's default. */
	stack: string | null;
}

const SANS_FALLBACK =
	'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SERIF_FALLBACK = 'ui-serif, Georgia, Cambria, "Times New Roman", serif';
const MONO_FALLBACK =
	'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace';

export const UI_FONTS = [
	{ id: "default", label: "Default", stack: null },
	{ id: "system", label: "System", stack: SANS_FALLBACK },
	{ id: "geist", label: "Geist", stack: `"Geist Variable", ${SANS_FALLBACK}` },
	{ id: "inter", label: "Inter", stack: `"Inter Variable", ${SANS_FALLBACK}` },
	{
		id: "atkinson",
		label: "Atkinson Hyperlegible",
		stack: `"Atkinson Hyperlegible Next Variable", ${SANS_FALLBACK}`,
	},
] as const satisfies readonly FontOption[];

/** Message text. "default" follows the UI font. */
export const READING_FONTS = [
	{ id: "default", label: "Same as interface", stack: null },
	...UI_FONTS.slice(1),
	{
		id: "source-serif",
		label: "Source Serif",
		stack: `"Source Serif 4 Variable", ${SERIF_FALLBACK}`,
	},
	{ id: "system-serif", label: "System serif", stack: SERIF_FALLBACK },
] as const satisfies readonly FontOption[];

export const CODE_FONTS = [
	{ id: "default", label: "Default", stack: null },
	{ id: "system-mono", label: "System monospace", stack: MONO_FALLBACK },
	{
		id: "geist-mono",
		label: "Geist Mono",
		stack: `"Geist Mono Variable", ${MONO_FALLBACK}`,
	},
	{
		id: "jetbrains-mono",
		label: "JetBrains Mono",
		stack: `"JetBrains Mono Variable", ${MONO_FALLBACK}`,
	},
] as const satisfies readonly FontOption[];

type Ids<T extends readonly FontOption[]> = T[number]["id"];

export const fontIds = <T extends readonly FontOption[]>(fonts: T) =>
	fonts.map((font) => font.id) as [Ids<T>, ...Ids<T>[]];

export function fontStack(
	fonts: readonly FontOption[],
	id: string,
): string | null {
	return fonts.find((font) => font.id === id)?.stack ?? null;
}
