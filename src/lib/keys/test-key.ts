import type { ProviderId } from "./providers";

// "Test key" in settings: one authenticated GET to the provider's own API. Besides the chat
// transport (1.2), this is the only code that puts a key in a request (docs/security.md, "API keys").
// Most providers' model lists need the key. OpenRouter's, Hugging Face's and AI Gateway's are public,
// so those use an endpoint that does need it.

interface TestRequest {
	url: string;
	headers: (key: string) => Record<string, string>;
	/** Pulls a model count out of the response, when the endpoint is a model list. */
	countModels?: (body: unknown) => number | undefined;
}

const bearer = (key: string) => ({ Authorization: `Bearer ${key}` });

const countData = (body: unknown) =>
	arrayLength((body as { data?: unknown } | null)?.data);

const openAiStyle = (url: string): TestRequest => ({
	url,
	headers: bearer,
	countModels: countData,
});

export const TEST_REQUESTS: Record<ProviderId, TestRequest> = {
	openai: openAiStyle("https://api.openai.com/v1/models"),
	anthropic: {
		url: "https://api.anthropic.com/v1/models?limit=1000",
		headers: (key) => ({
			"x-api-key": key,
			"anthropic-version": "2023-06-01",
			"anthropic-dangerous-direct-browser-access": "true",
		}),
		countModels: countData,
	},
	google: {
		// The key goes in a header, never the `?key=` query parameter (no keys in URLs).
		url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
		headers: (key) => ({ "x-goog-api-key": key }),
		countModels: (body) =>
			arrayLength((body as { models?: unknown } | null)?.models),
	},
	xai: openAiStyle("https://api.x.ai/v1/models"),
	mistral: openAiStyle("https://api.mistral.ai/v1/models"),
	deepseek: openAiStyle("https://api.deepseek.com/models"),
	groq: openAiStyle("https://api.groq.com/openai/v1/models"),
	together: {
		url: "https://api.together.xyz/v1/models",
		headers: bearer,
		// Together answers with a bare array.
		countModels: arrayLength,
	},
	fireworks: openAiStyle("https://api.fireworks.ai/inference/v1/models"),
	moonshot: openAiStyle("https://api.moonshot.ai/v1/models"),
	cerebras: openAiStyle("https://api.cerebras.ai/v1/models"),
	openrouter: { url: "https://openrouter.ai/api/v1/key", headers: bearer },
	huggingface: {
		url: "https://huggingface.co/api/whoami-v2",
		headers: bearer,
	},
	vercel: { url: "https://ai-gateway.vercel.sh/v1/credits", headers: bearer },
};

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
