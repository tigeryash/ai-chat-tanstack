import { useEffect } from "react";
import { logWarn } from "@/lib/log";

/**
 * Keeps <html> in step with Appearance settings (roadmap 3.11), from this tab or another. The <head>
 * script already applied the saved look before first paint, so the settings code loads lazily (it
 * stays off every page's first load) and then re-applies it (refreshing the stored snapshot) and
 * follows every change.
 */
export function AppearanceSync() {
	useEffect(() => {
		let stop: (() => void) | undefined;
		let unmounted = false;
		import("@/lib/appearance/sync")
			.then(({ startAppearanceSync }) => {
				if (!unmounted) stop = startAppearanceSync();
			})
			.catch((error: unknown) =>
				logWarn("Couldn't load appearance settings:", error),
			);
		return () => {
			unmounted = true;
			stop?.();
		};
	}, []);
	return null;
}
