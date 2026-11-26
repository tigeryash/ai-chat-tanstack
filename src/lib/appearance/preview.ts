import type { AppearanceSettings } from "./schema";
import { appearanceSnapshot } from "./snapshot";
import { tokenValue } from "./theme-colors";
import { COLOR_TOKENS, type ColorTokenName } from "./tokens";

/**
 * Custom properties that make an element's subtree look like `settings` (the presets grid's preview
 * cards, roadmap R2 S9). Every color token is set, not only the changed ones: a `var(--foreground)`
 * default resolves where it's declared, so the subtree needs its own copy to follow a new
 * `--foreground`. Each is a light-dark() pair, so the preview follows the page's scheme.
 */
export function previewVars(
	settings: AppearanceSettings,
): Record<string, string> {
	const { vars } = appearanceSnapshot(settings);
	const colors = Object.fromEntries(
		COLOR_TOKENS.map(({ name }) => {
			const light = tokenValue(settings, "light", name as ColorTokenName);
			const dark = tokenValue(settings, "dark", name as ColorTokenName);
			return [
				`--${name}`,
				light === dark ? light : `light-dark(${light}, ${dark})`,
			];
		}),
	);
	return { ...vars, ...colors };
}
