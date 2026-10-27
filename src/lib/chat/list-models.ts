import { getProviderKey, type ProviderId } from "@/lib/keys";
import { TEST_REQUESTS } from "@/lib/keys/test-key";
import { LOCAL_BASE_URL } from "./language-model";
import { type ChatProviderId, LOCAL_PROVIDER } from "./model-selection";

// Model names for the temporary picker (until roadmap 2.2 reads the synced catalog). Providers whose key
// test is a model list reuse that request, key and all. OpenRouter's, Hugging Face's and AI Gateway's
// model lists are public, so those go without the key.

const PUBLIC_MODEL_LISTS: Partial<Record<ProviderId, string>> = {
	openrouter: "https://openrouter.ai/api/v1/models",
	huggingface: "https://router.huggingface.co/v1/models",
	vercel: "https://ai-gateway.vercel.sh/v1/models",
};

export type ModelList =
	| { ok: true; models: string[] }
	| { ok: false; reason: "no-key" | "failed" };

interface GoogleModel {
	name?: unknown;
	supportedGenerationMethods?: unknown;
}

/** Model ids from any of the list shapes providers answer with. */
export function modelIdsFrom(body: unknown): string[] {
	const record = (body ?? {}) as { data?: unknown; models?: unknown };
	if (Array.isArray(record.models)) {
		// Google: `models/gemini-…`, and only the ones that can chat.
		return (record.models as GoogleModel[])
			.filter(
				(model) =>
					!Array.isArray(model.supportedGenerationMethods) ||
					model.supportedGenerationMethods.includes("generateContent"),
			)
			.map((model) => model.name)
			.filter((name): name is string => typeof name === "string")
			.map((name) => name.replace(/^models\//, ""));
	}
	const list = Array.isArray(body) ? body : record.data;
	if (!Array.isArray(list)) return [];
	return list
		.map((model) => (model as { id?: unknown } | null)?.id)
		.filter((id): id is string => typeof id === "string");
}

async function request(
	providerId: ChatProviderId,
): Promise<{ url: string; headers?: Record<string, string> } | null> {
	if (providerId === LOCAL_PROVIDER) return { url: `${LOCAL_BASE_URL}/models` };
	const publicList = PUBLIC_MODEL_LISTS[providerId];
	if (publicList) return { url: publicList };
	const key = await getProviderKey(providerId);
	if (!key) return null;
	const test = TEST_REQUESTS[providerId];
	return { url: test.url, headers: test.headers(key) };
}

/** The provider's model ids, sorted. Failure bodies are never read (they can quote the key). */
export async function listModels(
	providerId: ChatProviderId,
	fetchImpl: typeof fetch = fetch,
): Promise<ModelList> {
	const target = await request(providerId);
	if (!target) return { ok: false, reason: "no-key" };
	try {
		const response = await fetchImpl(target.url, {
			headers: target.headers,
			// No cookies, and no Referer path: the provider only learns our origin.
			credentials: "omit",
			referrerPolicy: "origin",
		});
		if (!response.ok) return { ok: false, reason: "failed" };
		const ids = modelIdsFrom(await response.json());
		return { ok: true, models: [...new Set(ids)].sort() };
	} catch {
		return { ok: false, reason: "failed" };
	}
}
