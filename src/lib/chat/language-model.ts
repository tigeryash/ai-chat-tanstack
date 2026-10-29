import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGateway, type LanguageModel } from "ai";
import type { ProviderId } from "@/lib/keys";
import { createThinkTagModel } from "@/lib/reasoning-middleware";
import { LOCAL_PROVIDER, type ModelSelection } from "./model-selection";
import { openRouterMetadataExtractor } from "./reply-host";

// Builds the AI SDK model a chat streams from, in the browser (roadmap decision 3). Every base URL here
// is one of the CSP's provider origins (src/lib/security/provider-origins.ts), and the key goes only
// into that provider's own client, so it's only ever sent to that origin.

type OpenAiCompatibleId = Exclude<
	ProviderId,
	"anthropic" | "google" | "vercel"
>;

/** Providers that speak OpenAI's chat completions API, and where. */
export const OPENAI_COMPATIBLE_BASE_URLS: Record<OpenAiCompatibleId, string> = {
	openai: "https://api.openai.com/v1",
	xai: "https://api.x.ai/v1",
	mistral: "https://api.mistral.ai/v1",
	deepseek: "https://api.deepseek.com/v1",
	groq: "https://api.groq.com/openai/v1",
	together: "https://api.together.xyz/v1",
	fireworks: "https://api.fireworks.ai/inference/v1",
	moonshot: "https://api.moonshot.ai/v1",
	cerebras: "https://api.cerebras.ai/v1",
	openrouter: "https://openrouter.ai/api/v1",
	huggingface: "https://router.huggingface.co/v1",
};

/**
 * The model for `selection`. `key` is the provider's key from the vault (`getProviderKey`), or null
 * for a local server, which is called at `localBaseUrl` (a saved endpoint's URL, which
 * `checkBaseUrl` keeps to the CSP's localhost origins). `fetchImpl` is for tests.
 */
export function createLanguageModel(
	{ provider, model }: ModelSelection,
	key: string | null,
	fetchImpl?: typeof fetch,
	localBaseUrl?: string,
): LanguageModel {
	const apiKey = key ?? undefined;
	switch (provider) {
		case LOCAL_PROVIDER:
			if (!localBaseUrl)
				throw new Error("A local model needs its endpoint's URL.");
			// Local reasoning models (DeepSeek R1 distills, Qwen, GLM) put their thinking in <think> tags.
			return createThinkTagModel(
				createOpenAICompatible({
					name: "local",
					baseURL: localBaseUrl,
					fetch: fetchImpl,
				})(model),
			);
		case "anthropic":
			return createAnthropic({
				apiKey,
				// Anthropic refuses browser calls without it. The name warns against shipping your own key in a
				// web page; here every key is the user's own (docs/security.md, "API keys").
				headers: { "anthropic-dangerous-direct-browser-access": "true" },
				fetch: fetchImpl,
			})(model);
		case "google":
			// Sends the key in the `x-goog-api-key` header, never the URL.
			return createGoogleGenerativeAI({ apiKey, fetch: fetchImpl })(model);
		case "vercel":
			return createGateway({ apiKey, fetch: fetchImpl })(model);
		case "openrouter":
			return createOpenAICompatible({
				name: provider,
				baseURL: OPENAI_COMPATIBLE_BASE_URLS.openrouter,
				apiKey,
				fetch: fetchImpl,
				includeUsage: true,
				// Records which upstream answered and the real cost (roadmap 2.2b).
				metadataExtractor: openRouterMetadataExtractor,
			})(model);
		default:
			return createOpenAICompatible({
				name: provider,
				baseURL: OPENAI_COMPATIBLE_BASE_URLS[provider],
				apiKey,
				fetch: fetchImpl,
			})(model);
	}
}
