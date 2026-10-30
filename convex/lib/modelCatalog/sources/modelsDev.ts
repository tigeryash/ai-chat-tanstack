import {
	NATIVE_ID_PROVIDERS,
	type NativeIdProvider,
} from "../../../../src/models/providers";
import { z } from "../../zod";
import { fetchJson } from "./http";

// models.dev: an open catalog keyed by provider, listing each provider's own model ids. One ~6 MB
// document, which is why the sync action runs in Convex's Node runtime.
export const MODELS_DEV_URL = "https://models.dev/api.json";

/** Our provider id → models.dev's. */
export const MODELS_DEV_PROVIDER_IDS: Record<NativeIdProvider, string> = {
	openai: "openai",
	anthropic: "anthropic",
	google: "google",
	xai: "xai",
	mistral: "mistral",
	deepseek: "deepseek",
	groq: "groq",
	together: "togetherai",
	fireworks: "fireworks-ai",
	moonshot: "moonshotai",
	cerebras: "cerebras",
	huggingface: "huggingface",
};

const providerSchema = z.object({
	models: z.record(z.string(), z.object({ id: z.string().min(1) })),
});

/** Each provider's native model ids. A provider missing from the document gets an empty list. */
export type NativeModelIds = Record<NativeIdProvider, string[]>;

export function parseModelsDev(body: unknown): {
	ids: NativeModelIds;
	missingProviders: string[];
} {
	const document = z.record(z.string(), z.unknown()).parse(body);
	const missingProviders: string[] = [];
	const entries = NATIVE_ID_PROVIDERS.map(
		(provider): [NativeIdProvider, string[]] => {
			const parsed = providerSchema.safeParse(
				document[MODELS_DEV_PROVIDER_IDS[provider]],
			);
			if (!parsed.success) {
				missingProviders.push(provider);
				return [provider, []];
			}
			return [
				provider,
				Object.values(parsed.data.models).map((model) => model.id),
			];
		},
	);
	if (missingProviders.length === NATIVE_ID_PROVIDERS.length) {
		throw new Error("models.dev: none of our providers are in the document");
	}
	return {
		ids: Object.fromEntries(entries) as NativeModelIds,
		missingProviders,
	};
}

export async function fetchModelsDev(): Promise<
	ReturnType<typeof parseModelsDev>
> {
	return parseModelsDev(await fetchJson(MODELS_DEV_URL));
}
