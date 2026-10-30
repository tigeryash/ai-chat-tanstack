// What page views and Web Vitals report as the page (roadmap 1.8). Vercel's scripts read the full URL;
// this keeps only the route: no query string (OpenRouter's sign-in callback carries `?code=`, a reset
// link `?token=`) and no fragment, and a chat's id becomes `[chatId]`.

const KNOWN_PATHS = new Set([
	"/",
	"/new",
	"/settings",
	"/login",
	"/signup",
	"/forgot-password",
	"/reset-password",
	"/privacy",
	"/terms",
]);

/** The route for a pathname: a known page as is, `/[chatId]` for a chat, `/[other]` for anything else. */
export function pageRoute(pathname: string): string {
	const path =
		pathname.length > 1 && pathname.endsWith("/")
			? pathname.slice(0, -1)
			: pathname;
	if (KNOWN_PATHS.has(path)) return path;
	if (path === "/e2e" || path.startsWith("/e2e/")) return "/e2e";
	if (/^\/[^/]+$/.test(path)) return "/[chatId]";
	return "/[other]";
}

/** `url` reduced to its origin plus `pageRoute`. A URL that doesn't parse becomes null (dropped). */
export function sanitizePageUrl(url: string): string | null {
	try {
		const parsed = new URL(url);
		return `${parsed.origin}${pageRoute(parsed.pathname)}`;
	} catch {
		return null;
	}
}
