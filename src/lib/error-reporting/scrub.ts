import type {
	Breadcrumb,
	ErrorEvent,
	Exception,
	StackFrame,
} from "@sentry/browser";
import { pageRoute } from "@/lib/analytics/page-url";
import { REDACTED, redactString } from "@/lib/redact";

// What an error report may carry (roadmap 1.8b, hard rules 1 and 4). Rather than deleting the risky
// parts of Sentry's event, `scrubEvent` builds a new one from an allowlist: the error's type, a scrubbed
// and shortened error message, stack frames as file, function, line and column, the page's route, and
// route changes as breadcrumbs. Everything else (free-text `message`, request headers, bodies, query
// strings, cookies, user, extra, contexts, tags, fingerprint, frame variables and source lines) never
// makes it into the copy.
//
// An error message can still quote what the code put in it. Keys and quoted text are removed here; app
// code must never build an error message from a prompt, reply, file or file name.

const MAX_MESSAGE_LENGTH = 300;
const MAX_EXCEPTIONS = 5;
const MAX_FRAMES = 50;
const MAX_BREADCRUMBS = 20;

/** A URL anywhere in a message, up to whitespace or a closing quote or bracket. */
const URL_IN_TEXT = /\bhttps?:\/\/[^\s"'`<>)\]]+/gi;
/**
 * Quoted text in an error message is usually the data that broke something, and that can be content:
 * Chrome's JSON.parse error quotes the text it failed on (`"hello worl"... is not valid JSON`), a
 * file error may quote a file name. Double quotes, backticks and curly quotes go; single quotes stay,
 * since engines use them for property names and tokens (`reading 'map'`).
 */
const QUOTED_TEXT = /"[^"]*"|`[^`]*`|“[^”]*”/g;
/**
 * Sentry's text for a rejection or throw that isn't an Error, followed by the value itself (a string a
 * promise rejected with, an object's keys). The value goes; the label stays.
 */
const NON_ERROR_VALUE =
	/^((?:Non-Error (?:promise rejection|exception) captured with (?:value|keys)|Object captured as (?:promise rejection|exception) with keys)):.*$/s;

/** `url` without query string or fragment. Our own pages are also reduced to their route. */
export function scrubUrl(url: string, ownOrigin = currentOrigin()): string {
	try {
		const parsed = new URL(url);
		const path =
			parsed.origin === ownOrigin && !isAssetPath(parsed.pathname)
				? pageRoute(parsed.pathname)
				: parsed.pathname;
		return `${parsed.origin}${path}`;
	} catch {
		return REDACTED;
	}
}

/** Keys and secrets out, URLs cut to origin and path, quoted text replaced, then shortened. */
export function scrubText(text: string): string {
	// URLs first, so a key in a query string goes with the query string.
	const scrubbed = redactString(
		text
			.replace(NON_ERROR_VALUE, `$1: ${REDACTED}`)
			.replace(URL_IN_TEXT, (url) => scrubUrl(url)),
	).replace(QUOTED_TEXT, `"${REDACTED}"`);
	return scrubbed.length > MAX_MESSAGE_LENGTH
		? `${scrubbed.slice(0, MAX_MESSAGE_LENGTH)}…`
		: scrubbed;
}

/**
 * Sentry's `beforeSend`: a scrubbed copy of `event`, or null to drop it when analytics are off in this
 * browser (Settings → Analytics, Global Privacy Control, Do Not Track), checked on every event.
 */
export function scrubEvent(
	event: ErrorEvent,
	allowed: () => boolean,
): ErrorEvent | null {
	if (!allowed()) return null;
	const exceptions = event.exception?.values
		?.slice(-MAX_EXCEPTIONS)
		.map(scrubException);
	const breadcrumbs = (event.breadcrumbs ?? [])
		.map(scrubBreadcrumb)
		.filter((crumb): crumb is Breadcrumb => crumb !== null)
		.slice(-MAX_BREADCRUMBS);
	return withoutUndefined({
		type: undefined,
		event_id: event.event_id,
		timestamp: event.timestamp,
		platform: event.platform,
		level: event.level,
		environment: event.environment,
		release: event.release,
		sdk: event.sdk && {
			name: event.sdk.name,
			version: event.sdk.version,
			// Tells Sentry not to fill in the sender's IP address.
			settings: { infer_ip: "never" },
		},
		exception: exceptions && { values: exceptions },
		request: event.request?.url
			? { url: scrubUrl(event.request.url) }
			: undefined,
		breadcrumbs: breadcrumbs.length > 0 ? breadcrumbs : undefined,
	}) as ErrorEvent;
}

/**
 * Sentry's `beforeBreadcrumb`, also applied to the breadcrumbs of each event. Only route changes are
 * kept, as routes; console, click, fetch and XHR breadcrumbs (whose URLs can carry a provider key in
 * the query string, and whose messages can quote content) are dropped.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
	if (breadcrumb.category !== "navigation") return null;
	const from = breadcrumb.data?.from;
	const to = breadcrumb.data?.to;
	return withoutUndefined({
		category: "navigation",
		timestamp: breadcrumb.timestamp,
		data: {
			from: typeof from === "string" ? routeOf(from) : undefined,
			to: typeof to === "string" ? routeOf(to) : undefined,
		},
	});
}

function scrubException(exception: Exception): Exception {
	const frames = exception.stacktrace?.frames
		?.slice(-MAX_FRAMES)
		.map(scrubFrame);
	return withoutUndefined({
		type: exception.type === undefined ? undefined : scrubText(exception.type),
		value:
			exception.value === undefined ? undefined : scrubText(exception.value),
		mechanism: exception.mechanism && {
			type: exception.mechanism.type,
			handled: exception.mechanism.handled,
		},
		stacktrace: frames && { frames },
	});
}

function scrubFrame(frame: StackFrame): StackFrame {
	return withoutUndefined({
		filename: frame.filename && scrubUrl(frame.filename),
		abs_path: frame.abs_path && scrubUrl(frame.abs_path),
		function: frame.function,
		lineno: frame.lineno,
		colno: frame.colno,
		in_app: frame.in_app,
	});
}

/** A breadcrumb's `from`/`to` is a path (`/abc?x=1`) or a URL; either way only the route stays. */
function routeOf(location: string): string {
	try {
		return pageRoute(new URL(location, "http://route.invalid").pathname);
	} catch {
		return REDACTED;
	}
}

function isAssetPath(pathname: string): boolean {
	return pathname.startsWith("/assets/") || pathname.startsWith("/_");
}

function currentOrigin(): string | undefined {
	return typeof location === "undefined" ? undefined : location.origin;
}

function withoutUndefined<T extends object>(value: T): T {
	return Object.fromEntries(
		Object.entries(value).filter(([, item]) => item !== undefined),
	) as T;
}
