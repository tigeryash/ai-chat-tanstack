import { AA_CONTRAST, contrastRatio } from "./color";
import type { AppearanceSettings } from "./schema";
import { resolveColor } from "./theme-colors";
import type { ColorScheme, ColorTokenName } from "./tokens";

// The text/background pairs the app actually draws, checked against WCAG AA (4.5:1) for the warning in
// Settings → Appearance. The default theme passes all of them in both schemes (contrast.test.ts).

export interface ContrastPair {
	text: ColorTokenName;
	background: ColorTokenName;
}

const pair = (text: ColorTokenName, background: ColorTokenName) => ({
	text,
	background,
});

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
	pair("foreground", "background"),
	pair("card-foreground", "card"),
	pair("popover-foreground", "popover"),
	pair("primary-foreground", "primary"),
	pair("secondary-foreground", "secondary"),
	pair("muted-foreground", "muted"),
	pair("muted-foreground", "card"),
	pair("muted-foreground", "background"),
	pair("accent-foreground", "accent"),
	pair("sidebar-foreground", "sidebar"),
	pair("sidebar-accent-foreground", "sidebar-accent"),
	pair("sidebar-primary-foreground", "sidebar-primary"),
	pair("overlay-foreground", "overlay"),
	pair("destructive-foreground", "card"),
	pair("success", "card"),
	pair("warning", "card"),
	pair("link", "card"),
];

export interface ContrastWarning extends ContrastPair {
	scheme: ColorScheme;
	ratio: number;
}

/** Every pair below AA in `scheme`. */
export function contrastWarnings(
	settings: AppearanceSettings,
	scheme: ColorScheme,
): ContrastWarning[] {
	return CONTRAST_PAIRS.flatMap((p) => {
		const ratio = contrastRatio(
			resolveColor(settings, scheme, p.text),
			resolveColor(settings, scheme, p.background),
		);
		return ratio < AA_CONTRAST ? [{ ...p, scheme, ratio }] : [];
	});
}
