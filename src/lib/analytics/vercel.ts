import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";
import { analyticsAllowed } from "./consent";
import { sanitizePageUrl } from "./page-url";

// Vercel Web Analytics (page views) and Speed Insights (Web Vitals), roadmap 1.8. Both are cookieless.
// Their scripts load from this site (`/_vercel/insights/script.js`, `/_vercel/speed-insights/script.js`)
// and post back to it, so the CSP needs nothing new: `connect-src 'self'` covers the requests, and
// 'strict-dynamic' trusts a script our own nonce'd code inserts. Vercel serves those paths only once
// Web Analytics and Speed Insights are on in the project's dashboard; until then the scripts 404.
//
// Nothing loads while analytics are off (consent.ts). Switched off later, the scripts stay in the page
// but `beforeSend` drops every event, because it reads the setting each time.

let started = false;

function scrubbed<Event extends { url: string; route?: string }>(
	event: Event,
): Event | null {
	if (!analyticsAllowed()) return null;
	const url = sanitizePageUrl(event.url);
	if (!url) return null;
	const route = new URL(url).pathname;
	return { ...event, url, ...(event.route === undefined ? {} : { route }) };
}

/** Loads both scripts once per page, if analytics are allowed. Safe to call again after opting in. */
export function startVercelAnalytics(): void {
	if (started || !analyticsAllowed()) return;
	started = true;
	inject({
		mode: "production",
		framework: "tanstack-start",
		// Explicit, so a dev build never swaps in the debug script from va.vercel-scripts.com.
		scriptSrc: "/_vercel/insights/script.js",
		beforeSend: scrubbed,
	});
	injectSpeedInsights({
		framework: "tanstack-start",
		scriptSrc: "/_vercel/speed-insights/script.js",
		beforeSend: scrubbed,
	});
}
