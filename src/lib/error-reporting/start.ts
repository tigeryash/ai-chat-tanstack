import { analyticsAllowed } from "@/lib/analytics/consent";
import { logWarn } from "@/lib/log";

// Error reporting (roadmap 1.8b). Sentry's SDK is a separate chunk, imported only when a DSN is set
// (`VITE_SENTRY_DSN`, Vercel Production only) and analytics are allowed in this browser: with either
// missing, nothing loads and nothing is sent. Switched off after loading, `beforeSend` drops every
// event (scrub.ts), since it reads the setting each time.

type SentryModule = typeof import("./sentry");

let sentry: Promise<SentryModule | null> | null = null;

/** Loads and starts Sentry once, if allowed. Resolves whether it is running. */
export function startErrorReporting(
	dsn: string | undefined,
	environment: string,
	allowed: () => boolean = analyticsAllowed,
): Promise<boolean> {
	if (!dsn || !allowed()) return Promise.resolve(sentry !== null);
	sentry ??= import("./sentry")
		.then((module) => {
			module.initSentry(dsn, environment);
			return module;
		})
		.catch((error: unknown) => {
			logWarn("Error reporting failed to load", error);
			sentry = null;
			return null;
		});
	return sentry.then((module) => module !== null);
}

/** Sends an error the app caught (the router's error screen). Does nothing while Sentry isn't running. */
export function reportError(error: unknown): void {
	void sentry?.then((module) => module?.captureError(error));
}

/** Tests only: forget a started Sentry. */
export function resetErrorReportingForTests(): void {
	sentry = null;
}
