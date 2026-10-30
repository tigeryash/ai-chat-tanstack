import {
	type KeyTestAuth,
	type ModelListShape,
	PROVIDER_IDS,
	providerEntry,
} from "@/models/provider-registry";
import type { ProviderId } from "./providers";

// "Test key" in settings: one authenticated GET to the provider's own API. Besides the chat
// transport (1.2), this is the only code that puts a key in a request (docs/security.md, "API keys").
// Most providers' model lists need the key. OpenRouter's, Hugging Face's and AI Gateway's are public,
// so those use an endpoint that does need it. The URLs live in the provider registry
// (src/models/provider-registry.ts).

interface TestRequest {
	url: string;
	headers: (key: string) => Record<string, string>;
	/** Pulls a model count out of the response, when the endpoint is a model list. */
	countModels?: (body: unknown) => number | undefined;
}

const AUTH_HEADERS: Record<
	KeyTestAuth,
	(key: string) => Record<string, string>
> = {
	bearer: (key) => ({ Authorization: `Bearer ${key}` }),
	anthropic: (key) => ({
		"x-api-key": key,
		"anthropic-version": "2023-06-01",
		"anthropic-dangerous-direct-browser-access": "true",
	}),
	// The key goes in a header, never the `?key=` query parameter (no keys in URLs).
	google: (key) => ({ "x-goog-api-key": key }),
};

const MODEL_COUNTERS: Record<
	ModelListShape,
	(body: unknown) => number | undefined
> = {
	data: (body) => arrayLength((body as { data?: unknown } | null)?.data),
	models: (body) => arrayLength((body as { models?: unknown } | null)?.models),
	array: arrayLength,
};

function testRequest(providerId: ProviderId): TestRequest {
	const { url, auth, modelList } = providerEntry(providerId).keyTest;
	return {
		url,
		headers: AUTH_HEADERS[auth],
		countModels: modelList && MODEL_COUNTERS[modelList],
	};
}

export const TEST_REQUESTS = Object.fromEntries(
	PROVIDER_IDS.map((id) => [id, testRequest(id)]),
) as Record<ProviderId, TestRequest>;

export type KeyTestResult =
	| { ok: true; modelCount?: number }
	| {
			ok: false;
			reason: "rejected" | "rate-limited" | "provider-error" | "unreachable";
	  };

/**
 * Checks `key` against `providerId`'s API. Only the status is read for failures: error bodies can
 * quote part of the key, so they're never shown or logged.
 */
export async function testProviderKey(
	providerId: ProviderId,
	key: string,
	fetchImpl: typeof fetch = fetch,
): Promise<KeyTestResult> {
	const request = TEST_REQUESTS[providerId];
	let response: Response;
	try {
		response = await fetchImpl(request.url, {
			headers: request.headers(key),
			// No cookies, and no Referer path: the provider only learns our origin.
			credentials: "omit",
			referrerPolicy: "origin",
			cache: "no-store",
		});
	} catch {
		return { ok: false, reason: "unreachable" };
	}
	if (response.ok) {
		const body: unknown = await response.json().catch(() => null);
		return { ok: true, modelCount: request.countModels?.(body) };
	}
	if (response.status === 429) return { ok: false, reason: "rate-limited" };
	if (response.status >= 500) return { ok: false, reason: "provider-error" };
	return { ok: false, reason: "rejected" };
}

function arrayLength(value: unknown): number | undefined {
	return Array.isArray(value) ? value.length : undefined;
}
