import { CODE_FONTS, fontStack, READING_FONTS, UI_FONTS } from "./fonts";
import type { AppearanceSettings } from "./schema";
import { overriddenColors, tokenValue } from "./theme-colors";
import { COLOR_TOKEN_NAMES, type ColorTokenName } from "./tokens";

// Settings → what goes on <html>: a `dark` / `light` class (none follows the system) and custom
// properties that override styles.css's tokens. The no-flash script in <head> applies the stored
// snapshot before first paint (boot-script.ts), so it never needs this logic.

export interface AppearanceSnapshot {
	scheme: "light" | "dark" | null;
	vars: Record<string, string>;
}

/** Tailwind's spacing step per density. 0.25rem is Tailwind's default. */
const SPACING = { compact: "0.21875rem", comfortable: null } as const;

/** Every property a snapshot can set, so applying one clears what the last one set. */
export const MANAGED_VARS = [
	"--font-size-root",
	"--spacing",
	"--ui-font",
	"--reading-font",
	"--code-font",
	...COLOR_TOKEN_NAMES.map((name) => `--${name}`),
];

export function appearanceSnapshot(
	settings: AppearanceSettings,
): AppearanceSnapshot {
	const vars: Record<string, string> = {};
	const set = (name: string, value: string | null) => {
		if (value !== null) vars[name] = value;
	};
	set(
		"--font-size-root",
		settings.textScale === 1 ? null : `${settings.textScale * 100}%`,
	);
	set("--spacing", SPACING[settings.density]);
	set("--ui-font", fontStack(UI_FONTS, settings.uiFont));
	set("--reading-font", fontStack(READING_FONTS, settings.readingFont));
	set("--code-font", fontStack(CODE_FONTS, settings.codeFont));

	const changed = new Set<ColorTokenName>([
		...(Object.keys(overriddenColors(settings, "light")) as ColorTokenName[]),
		...(Object.keys(overriddenColors(settings, "dark")) as ColorTokenName[]),
	]);
	for (const name of changed) {
		const light = tokenValue(settings, "light", name);
		const dark = tokenValue(settings, "dark", name);
		vars[`--${name}`] =
			light === dark ? light : `light-dark(${light}, ${dark})`;
	}

	return {
		scheme: settings.theme === "system" ? null : settings.theme,
		vars,
	};
}
