import { contrastRatio, parseColor, type Rgb, toHex } from "./color";
import type { AppearanceSettings } from "./schema";
import {
	COLOR_TOKENS,
	type ColorScheme,
	type ColorToken,
	type ColorTokenName,
} from "./tokens";

// What each color token ends up as for given settings: the default, the accent, or an Advanced
// override (highest wins). Shared by the CSS that applies them and the contrast check.

const TOKENS_BY_NAME = new Map<string, ColorToken>(
	COLOR_TOKENS.map((t) => [t.name, t]),
);

const DARK_TEXT = "oklch(0.145 0 0)";
const LIGHT_TEXT = "oklch(0.985 0 0)";

/** Tokens the accent color sets, in both themes. */
function accentValues(accent: string): Partial<Record<ColorTokenName, string>> {
	const color = parseColor(accent);
	const onAccent =
		color &&
		contrastRatio(color, mustParse(DARK_TEXT)) >=
			contrastRatio(color, mustParse(LIGHT_TEXT))
			? DARK_TEXT
			: LIGHT_TEXT;
	return { primary: accent, ring: accent, "primary-foreground": onAccent };
}

/**
 * The value of every token that differs from styles.css in `scheme`, as written in CSS
 * (`#rrggbb`, `oklch(…)` or `var(--x)`).
 */
export function overriddenColors(
	settings: AppearanceSettings,
	scheme: ColorScheme,
): Partial<Record<ColorTokenName, string>> {
	return {
		...(settings.accent ? accentValues(settings.accent) : {}),
		...settings.colors[scheme],
	};
}

/** A token's value in `scheme`, overrides included, before `var()` is followed. */
export function tokenValue(
	settings: AppearanceSettings,
	scheme: ColorScheme,
	name: ColorTokenName,
): string {
	const override = overriddenColors(settings, scheme)[name];
	if (override) return override;
	const token = TOKENS_BY_NAME.get(name);
	if (!token) throw new Error(`Unknown color token ${name}`);
	return token[scheme];
}

const VAR_REFERENCE = /^var\(--([a-z0-9-]+)\)$/;

/** A token's color in `scheme`, following `var()` references. */
export function resolveColor(
	settings: AppearanceSettings,
	scheme: ColorScheme,
	name: ColorTokenName,
): Rgb {
	let value = tokenValue(settings, scheme, name);
	for (let hops = 0; hops < COLOR_TOKENS.length; hops++) {
		const reference = VAR_REFERENCE.exec(value);
		if (!reference) return mustParse(value);
		value = tokenValue(settings, scheme, reference[1] as ColorTokenName);
	}
	throw new Error(`Circular color token ${name}`);
}

/** For the color picker. */
export function resolveHex(
	settings: AppearanceSettings,
	scheme: ColorScheme,
	name: ColorTokenName,
): string {
	return toHex(resolveColor(settings, scheme, name));
}

function mustParse(value: string): Rgb {
	const color = parseColor(value);
	if (!color) throw new Error(`Not a color: ${value}`);
	return color;
}
