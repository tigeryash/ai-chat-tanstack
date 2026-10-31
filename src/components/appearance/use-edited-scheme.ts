import { useSyncExternalStore } from "react";
import type { Theme } from "@/lib/appearance/schema";
import type { ColorScheme } from "@/lib/appearance/tokens";

const PREFERS_DARK = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
	const query = window.matchMedia(PREFERS_DARK);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

const systemScheme = (): ColorScheme =>
	window.matchMedia(PREFERS_DARK).matches ? "dark" : "light";

/** The scheme on screen now: the chosen theme, or the system's when the theme is "system". */
export function useEditedScheme(theme: Theme): ColorScheme {
	const system = useSyncExternalStore<ColorScheme>(
		subscribe,
		systemScheme,
		() => "dark",
	);
	return theme === "system" ? system : theme;
}
