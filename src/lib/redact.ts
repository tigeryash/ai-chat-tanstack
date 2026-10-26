// The one scrubber for anything headed to logs, error reports, or analytics (docs/security.md,
// "Scrubbing"). It replaces key-shaped strings; it can't make content safe to send, so callers still
// pass only names, codes, and paths, never prompts or replies (hard rule 4).

export const REDACTED = "[redacted]";

// Each pattern with what replaces a match. Order matters: `sk-ant-…` / `sk-or-…` run before `sk-…`.
const SECRET_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
	// `Authorization: Bearer …` and other bearer or basic credentials, whatever the token looks like.
	[/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${REDACTED}`],
	// Anthropic, OpenRouter, OpenAI (sk-, sk-proj-, sk-svcacct-) and others that copied the sk- form.
	[/\bsk-ant-[A-Za-z0-9_-]{8,}/g, REDACTED],
	[/\bsk-or-[A-Za-z0-9_-]{8,}/g, REDACTED],
	[/\bsk-[A-Za-z0-9_-]{16,}/g, REDACTED],
	// Google API keys.
	[/\bAIza[A-Za-z0-9_-]{30,}/g, REDACTED],
	// xAI, Groq, Hugging Face, Fireworks, Replicate, Vercel AI Gateway.
	[/\bxai-[A-Za-z0-9_-]{16,}/g, REDACTED],
	[/\b(gsk|hf|fw|r8|vck)_[A-Za-z0-9_-]{16,}/g, REDACTED],
	// JSON Web Tokens (session and Convex auth tokens).
	[/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, REDACTED],
	// Header, JSON and query forms: `x-api-key: …`, `"apiKey":"…"`, `token=…`, `password=…`.
	[
		/\b(x-api-key|x-goog-api-key|api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password)(["']?\s*[:=]\s*["']?)[^\s"'&,;}]{4,}/gi,
		`$1$2${REDACTED}`,
	],
];

/** Replaces every key-shaped substring of `text` with `[redacted]`. */
export function redactString(text: string): string {
	return SECRET_PATTERNS.reduce(
		(scrubbed, [pattern, replacement]) =>
			scrubbed.replace(pattern, replacement),
		text,
	);
}

const SENSITIVE_FIELD =
	/^(authorization|cookie|set-cookie|x-api-key|x-goog-api-key|api[_-]?key|token|access[_-]?token|refresh[_-]?token|id[_-]?token|secret|password|key)$/i;
const MAX_DEPTH = 6;

/**
 * Returns a scrubbed copy of `value`: strings go through `redactString`, fields whose name says they
 * hold a secret are replaced outright, and errors keep only their name and scrubbed message (a stack
 * or `cause` can quote request bodies). Never mutates its input.
 */
export function redact<T>(value: T): T {
	return redactValue(value, 0, new WeakSet()) as T;
}

function redactValue(
	value: unknown,
	depth: number,
	seen: WeakSet<object>,
): unknown {
	if (typeof value === "string") return redactString(value);
	if (value === null || typeof value !== "object") return value;
	if (seen.has(value) || depth >= MAX_DEPTH) return "[omitted]";
	seen.add(value);

	if (value instanceof Error) {
		return { name: value.name, message: redactString(value.message) };
	}
	if (Array.isArray(value)) {
		return value.map((item) => redactValue(item, depth + 1, seen));
	}
	return Object.fromEntries(
		Object.entries(value).map(([field, item]) => [
			field,
			SENSITIVE_FIELD.test(field)
				? REDACTED
				: redactValue(item, depth + 1, seen),
		]),
	);
}
