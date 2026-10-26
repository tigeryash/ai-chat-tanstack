// Which URLs in model output may become links or images (docs/security.md, "Rendering model
// output"). Everything else renders as plain text. Relative URLs are refused too: in model output
// they would point at our own origin, which no reply has a reason to do.

export const ALLOWED_LINK_PREFIXES = [
	"https://",
	"http://",
	"mailto:",
] as const;
// Images are never loaded automatically; an allowed one is offered as a link instead.
export const ALLOWED_IMAGE_PREFIXES = ["https://"] as const;

/** The parsed URL when `raw` is absolute and starts with one of `prefixes`, else null. */
export function allowedUrl(
	raw: unknown,
	prefixes: readonly string[],
): URL | null {
	if (typeof raw !== "string") return null;
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	// Compare the normalized form, so `HTTPS://` or stray whitespace can't slip past a prefix check.
	return prefixes.some((prefix) => url.href.startsWith(prefix)) ? url : null;
}

/** What a link's hover text shows: the real host (or the address, for mailto). */
export function linkDestination(url: URL): string {
	return url.protocol === "mailto:" ? url.pathname : url.host;
}
