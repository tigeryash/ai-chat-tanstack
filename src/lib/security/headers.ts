// Security headers on every response (docs/security.md, "Baseline"). src/start.ts adds them to what
// our server sends, and vite.config.ts hands them to Nitro's route rules for the static files Vercel
// serves without it.
export const SECURITY_HEADERS = {
	// Two years, subdomains included. Browsers ignore it over plain http (local dev and preview).
	"Strict-Transport-Security": "max-age=63072000; includeSubDomains",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	// Microphone for voice (Phase 5), from our own pages only. Camera and location are never used.
	"Permissions-Policy":
		"microphone=(self), camera=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
	"Cross-Origin-Opener-Policy": "same-origin",
	// `frame-ancestors 'none'` covers this in current browsers; the header covers older ones.
	"X-Frame-Options": "DENY",
} as const satisfies Record<string, string>;

/** A copy of `response` with the security headers set (headers already on it win). */
export function withSecurityHeaders(response: Response): Response {
	const headers = new Headers(response.headers);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!headers.has(name)) headers.set(name, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
