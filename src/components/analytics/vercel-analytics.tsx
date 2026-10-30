import { useEffect } from "react";
import { useAnalyticsEnabled } from "@/lib/analytics/consent";
import { analyticsMode } from "@/lib/analytics/track";
import { startVercelAnalytics } from "@/lib/analytics/vercel";

/**
 * Loads Vercel Web Analytics and Speed Insights in production builds (roadmap 1.8), once analytics are
 * allowed in this browser, including after switching them back on. Renders nothing. `force` loads them
 * in dev and e2e builds too, for the CSP test page (/e2e/analytics).
 */
export function VercelAnalytics({ force = false }: { force?: boolean }) {
	const enabled = useAnalyticsEnabled();
	useEffect(() => {
		if (enabled && (force || analyticsMode() === "vercel")) {
			startVercelAnalytics();
		}
	}, [enabled, force]);
	return null;
}
