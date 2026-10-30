import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";

// Whether this browser sends analytics (roadmap 1.8). On by default; the Settings switch turns off page
// views, Web Vitals and `track()` together. A browser that sends Global Privacy Control or Do Not Track
// is treated as switched off, whatever the stored choice says.

export const ANALYTICS_SETTINGS_KEY = "highelo-analytics";

const schema = z.object({ enabled: z.boolean() });

export const analyticsSettings = createLocalStore(
	ANALYTICS_SETTINGS_KEY,
	schema,
	{
		enabled: true,
	},
);

export function setAnalyticsEnabled(enabled: boolean): void {
	analyticsSettings.write({ enabled });
}

/** Wrapped in a `use…` function so React (and its compiler) treat the read as a hook. */
export function useAnalyticsEnabled(): boolean {
	return analyticsSettings.use().enabled;
}

interface PrivacySignals {
	globalPrivacyControl?: boolean;
	doNotTrack?: string | null;
}

/** True when the browser sends Global Privacy Control or Do Not Track. */
export function browserAsksNotToTrack(
	nav: PrivacySignals | undefined = typeof navigator === "undefined"
		? undefined
		: (navigator as PrivacySignals),
): boolean {
	if (!nav) return false;
	return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

/** Read on every event, so switching off takes effect at once. Always false on the server. */
export function analyticsAllowed(): boolean {
	if (typeof window === "undefined") return false;
	return analyticsSettings.read().enabled && !browserAsksNotToTrack();
}
