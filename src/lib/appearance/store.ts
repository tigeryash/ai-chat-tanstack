import { createLocalStore } from "@/lib/local-store";
import {
	type AppearanceSettings,
	appearanceSchema,
	DEFAULT_APPEARANCE,
} from "./schema";
import type { ColorScheme, ColorTokenName } from "./tokens";

// Appearance settings in this browser's localStorage (roadmap 3.11). `<AppearanceSync />` applies every
// change to the page, in every open tab.

export const APPEARANCE_SETTINGS_KEY = "highelo-appearance";

export const appearanceSettings = createLocalStore(
	APPEARANCE_SETTINGS_KEY,
	appearanceSchema,
	DEFAULT_APPEARANCE,
);

/** Wrapped in a `use…` function so React (and its compiler) treat the read as a hook. */
export function useAppearance(): AppearanceSettings {
	return appearanceSettings.use();
}

export function updateAppearance(patch: Partial<AppearanceSettings>): void {
	appearanceSettings.write({ ...appearanceSettings.read(), ...patch });
}

/** Sets or (with null) resets one token's color in one scheme. */
export function setTokenColor(
	scheme: ColorScheme,
	name: ColorTokenName,
	hex: string | null,
): void {
	const current = appearanceSettings.read();
	const { [name]: _removed, ...rest } = current.colors[scheme];
	appearanceSettings.write({
		...current,
		colors: {
			...current.colors,
			[scheme]: hex === null ? rest : { ...rest, [name]: hex },
		},
	});
}

export function resetAppearance(): void {
	appearanceSettings.write(DEFAULT_APPEARANCE);
}
