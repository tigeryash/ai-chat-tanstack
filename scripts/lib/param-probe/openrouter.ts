import { isRetryable, type ProbeOutcome } from "./classify";
import type { ProbeRequest } from "./probes";

// The probe's only network calls (roadmap 2.4a): OpenRouter's public model list, and chat
// completions with the developer's own key. The key goes only into the Authorization header of
// requests to openrouter.ai and is never printed.

export const OPENROUTER_CHAT_URL =
	"https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
const TIMEOUT_MS = 60_000;

export type OpenRouterListing = {
	id: string;
	supportedParameters: string[];
	pricing?: { prompt?: string; completion?: string; request?: string };
};

export async function fetchOpenRouterListings(
	fetchFn: typeof fetch = fetch,
): Promise<Map<string, OpenRouterListing>> {
	const response = await fetchFn(OPENROUTER_MODELS_URL, {
		headers: { accept: "application/json" },
	});
	if (!response.ok)
		throw new Error(`${OPENROUTER_MODELS_URL}: HTTP ${response.status}`);
	const body = (await response.json()) as { data?: unknown };
	const listings = new Map<string, OpenRouterListing>();
	for (const item of Array.isArray(body.data) ? body.data : []) {
		if (typeof item?.id !== "string") continue;
		listings.set(item.id, {
			id: item.id,
			supportedParameters: Array.isArray(item.supported_parameters)
				? item.supported_parameters.filter(
						(p: unknown) => typeof p === "string",
					)
				: [],
			pricing: typeof item.pricing === "object" ? item.pricing : undefined,
		});
	}
	return listings;
}

/** The JSON body for one probe. `require_parameters` makes unsupported parameters an error. */
export function chatBody(modelId: string, request: ProbeRequest) {
	return {
		model: modelId,
		messages: request.messages,
		max_tokens: request.maxTokens,
		...request.extra,
		stream: false,
		provider: { require_parameters: true },
	};
}

/** Seconds or an HTTP date in Retry-After, else exponential backoff with jitter. */
export function retryDelayMs(
	attempt: number,
	retryAfter: string | null,
	random: () => number = Math.random,
): number {
	const seconds = Number(retryAfter);
	if (retryAfter !== null && Number.isFinite(seconds) && seconds >= 0)
		return Math.min(seconds * 1_000, MAX_DELAY_MS);
	const date = retryAfter === null ? Number.NaN : Date.parse(retryAfter);
	if (Number.isFinite(date))
		return Math.min(Math.max(date - Date.now(), 0), MAX_DELAY_MS);
	const backoff = BASE_DELAY_MS * 2 ** (attempt - 1);
	return Math.min(backoff + random() * BASE_DELAY_MS, MAX_DELAY_MS);
}

const wait = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

export type SendOptions = {
	apiKey: string;
	fetchFn?: typeof fetch;
	sleep?: (ms: number) => Promise<void>;
};

async function readBody(response: Response): Promise<unknown> {
	const text = await response.text();
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

/**
 * Sends one probe, retrying rate limits, server errors, and network failures with backoff.
 * `attempts` lets the caller charge the budget for retries it couldn't see the cost of.
 */
export async function sendProbe(
	modelId: string,
	request: ProbeRequest,
	{ apiKey, fetchFn = fetch, sleep = wait }: SendOptions,
): Promise<{ outcome: ProbeOutcome; attempts: number }> {
	let last: ProbeOutcome = { kind: "network", message: "Not sent" };
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		let retryAfter: string | null = null;
		try {
			const response = await fetchFn(OPENROUTER_CHAT_URL, {
				method: "POST",
				headers: {
					authorization: `Bearer ${apiKey}`,
					"content-type": "application/json",
					"x-title": "High Elo LLMs parameter probe",
				},
				body: JSON.stringify(chatBody(modelId, request)),
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			last = {
				kind: "response",
				status: response.status,
				body: await readBody(response),
			};
			if (!isRetryable(response.status))
				return { outcome: last, attempts: attempt };
			retryAfter = response.headers.get("retry-after");
		} catch (error) {
			last = {
				kind: "network",
				message: error instanceof Error ? error.message : String(error),
			};
		}
		if (attempt < MAX_ATTEMPTS) await sleep(retryDelayMs(attempt, retryAfter));
	}
	return { outcome: last, attempts: MAX_ATTEMPTS };
}
