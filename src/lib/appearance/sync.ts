import { applyAppearance } from "./apply";
import { appearanceSettings } from "./store";

/** Applies the saved settings now and after every change (here or in another tab). Returns the stop. */
export function startAppearanceSync(): () => void {
	const apply = () => applyAppearance(appearanceSettings.read());
	apply();
	return appearanceSettings.subscribe(apply);
}
