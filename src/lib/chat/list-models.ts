import { LOCAL_BASE_URL } from "./language-model";

// What a local model server (LM Studio) reports at its OpenAI-style `/models`, for the picker's
// "Local" group. Catalog models come from the synced catalog instead (roadmap 2.2). Slice 2.3 adds
// endpoint settings and Ollama.

export type ModelList = { ok: true; models: string[] } | { ok: false };

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

/** The local server's model ids, sorted. Sends no key: local servers get none. */
export async function listLocalModels(
	fetchImpl: typeof fetch = fetch,
): Promise<ModelList> {
	try {
		const response = await fetchImpl(`${LOCAL_BASE_URL}/models`, {
			// No cookies, and no Referer path: the server only learns our origin.
			credentials: "omit",
			referrerPolicy: "origin",
		});
		if (!response.ok) return { ok: false };
		const ids = modelIdsFrom(await response.json());
		return { ok: true, models: [...new Set(ids)].sort() };
	} catch {
		return { ok: false };
	}
}
