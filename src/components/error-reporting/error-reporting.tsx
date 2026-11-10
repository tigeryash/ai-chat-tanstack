import { useEffect } from "react";
import { env } from "@/env";
import { useAnalyticsEnabled } from "@/lib/analytics/consent";
import { startErrorReporting } from "@/lib/error-reporting/start";

/**
 * Starts Sentry error reporting (roadmap 1.8b) when `VITE_SENTRY_DSN` is set and analytics are allowed
 * in this browser, including after switching them back on. Renders nothing.
 */
export function ErrorReporting() {
	const enabled = useAnalyticsEnabled();
	useEffect(() => {
		if (enabled)
			void startErrorReporting(env.VITE_SENTRY_DSN, import.meta.env.MODE);
	}, [enabled]);
	return null;
}
