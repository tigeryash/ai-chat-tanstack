// Relative, not `@/`: vite.config.ts imports this file, and Vite's config loader doesn't know the alias.
import { LOCAL_MODEL_ORIGINS, PROVIDER_API_ORIGINS } from "./provider-origins";

// Content Security Policy (docs/security.md, "Baseline"). Two policies go out with every page:
// - Enforced: the few directives nothing legitimate needs (plugins, <base>, being framed).
// - Report-only: the strict policy (nonce + 'strict-dynamic' scripts, connect-src allowlist). It
//   reports to CSP_REPORT_PATH instead of blocking until the reports stay clean.
// ENFORCE_STRICT_CSP moves the strict policy into the enforced header.

export const CSP_REPORT_PATH = "/api/csp-report";

/**
 * Whether the strict policy is enforced. Off until production logs show no `[csp]` lines after a week
 * of real use, signed-in chat included (Owner to-do in docs/ROADMAP.md); flipping it is the whole
 * change. On, the strict policy goes out as `Content-Security-Policy` and a report-only copy stays,
 * so a new directive can be trialled there first. The e2e `csp-enforced` project runs chat, keys and
 * local models with the strict policy enforced either way.
 */
export const ENFORCE_STRICT_CSP = false;

export const ENFORCED_CSP = [
	"object-src 'none'",
	"base-uri 'none'",
	"frame-ancestors 'none'",
].join("; ");

export interface StrictCspOptions {
	nonce: string;
	/** Convex deployment URLs (`VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`); unset ones are skipped. */
	convexUrls: ReadonlyArray<string | undefined>;
	/** Vite's dev server: allows its HMR WebSocket. */
	dev?: boolean;
}

export function buildStrictCsp({
	nonce,
	convexUrls,
	dev = false,
}: StrictCspOptions): string {
	const convexOrigins = convexUrls.flatMap(convexConnectSources);
	const directives: Record<string, readonly string[]> = {
		"default-src": ["'self'"],
		// 'strict-dynamic': scripts the nonce'd ones load are trusted; host lists and 'self' are
		// ignored by browsers that support it. No 'unsafe-eval' and no 'unsafe-inline'.
		"script-src": [`'nonce-${nonce}'`, "'strict-dynamic'"],
		// React, Motion and GSAP write `style` attributes, which a nonce can't cover. Styles can't run
		// script, and img/font/connect below close the CSS exfiltration channels.
		"style-src": ["'self'", "'unsafe-inline'"],
		// No remote images: model output shows a link instead of loading one (an image URL can carry
		// chat data out in its query string).
		"img-src": ["'self'", "data:", "blob:"],
		"font-src": ["'self'", "data:"],
		"connect-src": [
			"'self'",
			...convexOrigins,
			...PROVIDER_API_ORIGINS,
			...LOCAL_MODEL_ORIGINS,
			...(dev ? ["ws://localhost:*", "ws://127.0.0.1:*"] : []),
		],
		"media-src": ["'self'", "blob:"],
		// data: is the local-server CORS check (src/lib/local-endpoints/cors-check.ts): a data: worker has
		// an opaque origin, so its request asks the server as another website would. Starting a worker
		// takes script that's already running, and the worker inherits this policy's connect-src.
		"worker-src": ["'self'", "blob:", "data:"],
		"manifest-src": ["'self'"],
		// Nothing is framed yet. The artifacts sandbox origin goes here when it exists.
		"frame-src": ["'none'"],
		"form-action": ["'self'"],
		"object-src": ["'none'"],
		"base-uri": ["'none'"],
		"frame-ancestors": ["'none'"],
		// Only report-uri. With report-to present, Chrome ignores report-uri and queues reports through
		// the Reporting API, which delivered nothing in 70 s of testing; report-uri arrives at once,
		// and Firefox and Safari support it too.
		"report-uri": [CSP_REPORT_PATH],
	};
	return Object.entries(directives)
		.map(([name, sources]) => [name, ...unique(sources)].join(" "))
		.join("; ");
}

/** A Convex URL as CSP sources: its origin plus the WebSocket form the sync client uses. */
function convexConnectSources(url: string | undefined): string[] {
	if (!url) return [];
	let origin: string;
	try {
		origin = new URL(url).origin;
	} catch {
		return [];
	}
	return [origin, origin.replace(/^http/, "ws")];
}

function unique(values: readonly string[]): string[] {
	return [...new Set(values)];
}

/** 128 random bits, base64. One per HTML response. */
export function createNonce(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes));
}

/** The headers a page response carries for its CSP. */
export function cspHeaders(
	options: StrictCspOptions,
	enforce = ENFORCE_STRICT_CSP,
): Record<string, string> {
	return cspHeadersFor(buildStrictCsp(options), enforce);
}

/**
 * The two CSP headers for an already built strict policy. Enforced, the strict policy replaces
 * ENFORCED_CSP (it has all three of its directives) and the report-only copy starts out identical, so
 * a violation is reported twice, once per `disposition`.
 */
export function cspHeadersFor(
	strictPolicy: string,
	enforce: boolean,
): Record<string, string> {
	return {
		"Content-Security-Policy": enforce ? strictPolicy : ENFORCED_CSP,
		"Content-Security-Policy-Report-Only": strictPolicy,
	};
}

/**
 * e2e only: the cookie the `csp-enforced` Playwright project sets so that VITE_E2E builds enforce each
 * page's strict policy (src/start.ts), whatever ENFORCE_STRICT_CSP says.
 */
export const E2E_ENFORCE_CSP_COOKIE = "e2e-enforce-csp";

/** A copy of `response` with its strict policy enforced, as ENFORCE_STRICT_CSP would send it. */
export function withStrictCspEnforced(response: Response): Response {
	const strict = response.headers.get("Content-Security-Policy-Report-Only");
	if (!strict) return response;
	const headers = new Headers(response.headers);
	for (const [name, value] of Object.entries(cspHeadersFor(strict, true))) {
		headers.set(name, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
