import {
	breadcrumbsIntegration,
	browserApiErrorsIntegration,
	captureException,
	dedupeIntegration,
	globalHandlersIntegration,
	init,
	linkedErrorsIntegration,
} from "@sentry/browser";
import { analyticsAllowed } from "@/lib/analytics/consent";
import { scrubBreadcrumb, scrubEvent } from "./scrub";

// The Sentry browser SDK, loaded on demand by start.ts (never in a page's first load, and never while
// error reports are off). Only the integrations that catch errors are on: no tracing, no Session
// Replay, no console/click/fetch/XHR breadcrumbs, no sessions, and every kind of data collection off.

export function initSentry(dsn: string, environment: string): void {
	init({
		dsn,
		environment,
		defaultIntegrations: false,
		integrations: [
			globalHandlersIntegration(),
			browserApiErrorsIntegration(),
			linkedErrorsIntegration(),
			dedupeIntegration(),
			// Route changes only, scrubbed to routes by scrubBreadcrumb.
			breadcrumbsIntegration({
				dom: false,
				fetch: false,
				xhr: false,
				sentry: false,
				history: true,
			}),
		],
		// v11's replacement for `sendDefaultPii`: no user info, cookies, headers, bodies, query strings,
		// AI inputs or outputs, frame variables or source lines. (Console breadcrumbs are a separate
		// integration in v11, not added here.)
		dataCollection: {
			userInfo: false,
			cookies: false,
			httpHeaders: false,
			httpBodies: [],
			urlQueryParams: false,
			graphQL: { document: false, variables: false },
			genAI: { inputs: false, outputs: false },
			mcp: { inputs: false, outputs: false },
			databaseQueryData: false,
			queues: false,
			stackFrameVariables: false,
			frameContextLines: 0,
		},
		// "always" would rewrite fetch errors in the app itself to add the host name.
		enhanceFetchErrorMessages: false,
		sendClientReports: false,
		attachStacktrace: false,
		maxBreadcrumbs: 20,
		beforeBreadcrumb: scrubBreadcrumb,
		beforeSend: (event) => scrubEvent(event, analyticsAllowed),
	});
}

export function captureError(error: unknown): void {
	captureException(error);
}
