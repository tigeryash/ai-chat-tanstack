import { createGateway, type LanguageModel } from "ai";
import { createThinkTagModel } from "@/lib/reasoning-middleware";
import {
	type OpenAiCompatibleId,
	PROVIDER_IDS,
	providerEntry,
} from "@/models/provider-registry";
import { LOCAL_PROVIDER, type ModelSelection } from "./model-selection";
import { openRouterMetadataExtractor } from "./reply-host";

// Builds the AI SDK model a chat streams from, in the browser (roadmap decision 3). Every base URL here
// comes from the provider registry and is on one of the CSP's provider origins
// (src/lib/security/provider-origins.ts), and the key goes only into that provider's own client, so
// it's only ever sent to that origin.
// The provider SDKs load on first use, so pages that never chat don't download them (quality audit P1).
// The gateway stays a static import: `ai` bundles it anyway as its default provider.

/** Providers that speak OpenAI's chat completions API, and where (from the provider registry). */
export const OPENAI_COMPATIBLE_BASE_URLS = Object.fromEntries(
	PROVIDER_IDS.flatMap((id) => {
		const { chatBaseUrl } = providerEntry(id);
		return chatBaseUrl ? [[id, chatBaseUrl]] : [];
	}),
) as Record<OpenAiCompatibleId, string>;

/**
 * The model for `selection`. `key` is the provider's key from the vault (`getProviderKey`), or null
 * for a local server, which is called at `localBaseUrl` (a saved endpoint's URL, which
 * `checkBaseUrl` keeps to the CSP's localhost origins). `fetchImpl` is for tests.
 */
export async function createLanguageModel(
	{ provider, model }: ModelSelection,
	key: string | null,
	fetchImpl?: typeof fetch,
	localBaseUrl?: string,
): Promise<LanguageModel> {
	const apiKey = key ?? undefined;
	switch (provider) {
		case LOCAL_PROVIDER: {
			if (!localBaseUrl)
				throw new Error("A local model needs its endpoint's URL.");
			const { createOpenAICompatible } = await import(
				"@ai-sdk/openai-compatible"
			);
			// Local reasoning models (DeepSeek R1 distills, Qwen, GLM) put their thinking in <think> tags.
			return createThinkTagModel(
				createOpenAICompatible({
					name: "local",
					baseURL: localBaseUrl,
					fetch: fetchImpl,
				})(model),
			);
		}
		case "anthropic": {
			const { createAnthropic } = await import("@ai-sdk/anthropic");
			return createAnthropic({
				apiKey,
				// Anthropic refuses browser calls without it. The name warns against shipping your own key in a
				// web page; here every key is the user's own (docs/security.md, "API keys").
				headers: { "anthropic-dangerous-direct-browser-access": "true" },
				fetch: fetchImpl,
			})(model);
		}
		case "google": {
			const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
			// Sends the key in the `x-goog-api-key` header, never the URL.
			return createGoogleGenerativeAI({ apiKey, fetch: fetchImpl })(model);
		}
		case "vercel":
			return createGateway({ apiKey, fetch: fetchImpl })(model);
		case "openrouter": {
			const { createOpenAICompatible } = await import(
				"@ai-sdk/openai-compatible"
			);
			return createOpenAICompatible({
				name: provider,
				baseURL: OPENAI_COMPATIBLE_BASE_URLS.openrouter,
				apiKey,
				fetch: fetchImpl,
				includeUsage: true,
				// Records which upstream answered and the real cost (roadmap 2.2b).
				metadataExtractor: openRouterMetadataExtractor,
			})(model);
		}
		default: {
			const { createOpenAICompatible } = await import(
				"@ai-sdk/openai-compatible"
			);
			return createOpenAICompatible({
				name: provider,
				baseURL: OPENAI_COMPATIBLE_BASE_URLS[provider],
				apiKey,
				fetch: fetchImpl,
			})(model);
		}
	}
}
