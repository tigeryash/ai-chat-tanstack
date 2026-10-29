import type { ProbeStatus } from "../../../src/models/parameter-probe";
import type { ChatCompletion, CheckResult } from "./probes";

// Turns one probe's HTTP outcome into accepted / rejected / ignored / inconclusive (roadmap 2.4a).
// Requests carry `provider.require_parameters: true`, so OpenRouter answers 404 ("no endpoints
// found that can handle the requested parameters") instead of silently dropping one it can't route.

export type ProbeOutcome =
	| { kind: "response"; status: number; body: unknown }
	| { kind: "network"; message: string };

export type Classification = {
	status: ProbeStatus;
	note?: string;
	/** Stop the whole run: the key is wrong or out of credit, so every later request fails too. */
	fatal?: string;
};

const NOTE_LENGTH = 200;

/** HTTP statuses worth retrying with backoff before calling a probe inconclusive. */
export function isRetryable(status: number): boolean {
	return status === 408 || status === 429 || status >= 500;
}

export function errorMessage(body: unknown): string | undefined {
	if (typeof body === "string") return body.slice(0, NOTE_LENGTH) || undefined;
	if (typeof body !== "object" || body === null) return undefined;
	const error = (body as ChatCompletion).error;
	const message = error?.message;
	return typeof message === "string"
		? message.slice(0, NOTE_LENGTH)
		: undefined;
}

function errorCode(body: unknown): number | undefined {
	if (typeof body !== "object" || body === null) return undefined;
	const code = Number((body as ChatCompletion).error?.code);
	return Number.isFinite(code) ? code : undefined;
}

function classifyError(status: number, body: unknown): Classification {
	const message = errorMessage(body) ?? `HTTP ${status}`;
	if (status === 401)
		return {
			status: "inconclusive",
			fatal: `OpenRouter rejected the key (401): ${message}`,
		};
	if (status === 402)
		return {
			status: "inconclusive",
			fatal: `OpenRouter credit ran out (402): ${message}`,
		};
	if (status === 400 || status === 404 || status === 422)
		return { status: "rejected", note: message };
	// 403 is OpenRouter's moderation flag, the rest are transient: neither says anything about the parameter.
	return { status: "inconclusive", note: message };
}

/**
 * `check` is the probe's effect check, if it has one. A 200 whose check shows no effect is
 * "ignored"; a check that can't tell leaves it "accepted".
 */
export function classify(
	outcome: ProbeOutcome,
	check?: (completion: ChatCompletion) => CheckResult,
): Classification {
	if (outcome.kind === "network")
		return {
			status: "inconclusive",
			note: outcome.message.slice(0, NOTE_LENGTH),
		};
	const { status, body } = outcome;
	if (status !== 200) return classifyError(status, body);

	// OpenRouter sometimes reports a provider error inside a 200.
	const embedded = errorCode(body);
	if (embedded !== undefined || errorMessage(body) !== undefined)
		return classifyError(embedded ?? 500, body);

	const completion = body as ChatCompletion;
	if (!Array.isArray(completion?.choices) || completion.choices.length === 0)
		return { status: "inconclusive", note: "Reply had no choices" };
	if (check?.(completion) === "no-effect")
		return {
			status: "ignored",
			note: "Accepted, but the reply showed no effect",
		};
	return { status: "accepted" };
}
