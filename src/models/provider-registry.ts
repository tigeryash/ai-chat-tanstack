// Every provider a user can add a key for (roadmap decision 3: model calls go browser → provider), in
// one place. The key settings, chat transport, key test, picker host data, model catalog and CSP
// allowlist all derive from this, so adding a provider means adding one entry here.
//
// Adding or changing `apiOrigins` changes the CSP's `connect-src` (src/lib/security/provider-origins.ts):
// check the provider's CORS from a browser first and say so in the PR (docs/security.md, "API keys").
// Every other URL of an entry must sit on one of its own `apiOrigins`; tests check that.
//
// Imported by Convex (convex/lib/modelCatalog, through ./providers) and by vite.config.ts (through the
// CSP), so keep this file free of `@/` imports.

/** How the key test authenticates. Headers are built in src/lib/keys/test-key.ts. */
export type KeyTestAuth = "bearer" | "anthropic" | "google";

/** Where a model list response keeps its array: `{ data }`, `{ models }`, or a bare array. */
export type ModelListShape = "data" | "models" | "array";

export interface ProviderEntry {
	name: string;
	/** Where the user creates a key. Opened in a new tab, never fetched. */
	keyPageUrl: string;
	/** Origins the browser calls for this provider: the CSP allowlist. Reviewed, see above. */
	apiOrigins: readonly string[];
	/**
	 * Base URL of its OpenAI-compatible chat completions API. Unset for providers with their own SDK
	 * (Anthropic, Google, AI Gateway), which use that SDK's default URL.
	 */
	chatBaseUrl?: string;
	/** "Test key" in settings: one authenticated GET. */
	keyTest: {
		url: string;
		auth: KeyTestAuth;
		/** Set when the endpoint is a model list, to show a model count. */
		modelList?: ModelListShape;
	};
	/**
	 * Whether the model catalog records each model's native id for this provider. OpenRouter ids come
	 * from OpenRouter's own catalog and AI Gateway's id is the catalog row's id, so those two don't.
	 */
	nativeIds: boolean;
	/** Public, keyless API the model picker reads live host data from (roadmap 2.2b). */
	publicApiUrl?: string;
}

export const PROVIDER_REGISTRY = {
	openai: {
		name: "OpenAI",
		keyPageUrl: "https://platform.openai.com/api-keys",
		apiOrigins: ["https://api.openai.com"],
		chatBaseUrl: "https://api.openai.com/v1",
		keyTest: {
			url: "https://api.openai.com/v1/models",
			auth: "bearer",
			modelList: "data",
		},
		nativeIds: true,
	},
	anthropic: {
		name: "Anthropic",
		keyPageUrl: "https://platform.claude.com/settings/keys",
		apiOrigins: ["https://api.anthropic.com"],
		keyTest: {
			url: "https://api.anthropic.com/v1/models?limit=1000",
			auth: "anthropic",
			modelList: "data",
		},
		nativeIds: true,
	},
	google: {
		name: "Google Gemini",
		keyPageUrl: "https://aistudio.google.com/app/apikey",
		apiOrigins: ["https://generativelanguage.googleapis.com"],
		keyTest: {
			url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
			auth: "google",
			modelList: "models",
		},
		nativeIds: true,
	},
	xai: {
		name: "xAI",
		keyPageUrl: "https://console.x.ai",
		apiOrigins: ["https://api.x.ai"],
		chatBaseUrl: "https://api.x.ai/v1",
		keyTest: {
			url: "https://api.x.ai/v1/models",
			auth: "bearer",
			modelList: "data",
		},
		nativeIds: true,
	},
	mistral: {
		name: "Mistral",
		keyPageUrl: "https://console.mistral.ai/api-keys",
		apiOrigins: ["https://api.mistral.ai"],
		chatBaseUrl: "https://api.mistral.ai/v1",
		keyTest: {
			url: "https://api.mistral.ai/v1/models",
			auth: "bearer",
			modelList: "data",
		},
		nativeIds: true,
	},
	deepseek: {
		name: "DeepSeek",
		keyPageUrl: "https://platform.deepseek.com/api_keys",
		apiOrigins: ["https://api.deepseek.com"],
		chatBaseUrl: "https://api.deepseek.com/v1",
		keyTest: {
			url: "https://api.deepseek.com/models",
			auth: "bearer",
			modelList: "data",
		},
		nativeIds: true,
	},
	groq: {
		name: "Groq",
		keyPageUrl: "https://console.groq.com/keys",
		apiOrigins: ["https://api.groq.com"],
		chatBaseUrl: "https://api.groq.com/openai/v1",
		keyTest: {
			url: "https://api.groq.com/openai/v1/models",
			auth: "bearer",
			modelList: "data",
		},
		nativeIds: true,
	},
	together: {
		name: "Together AI",
		keyPageUrl: "https://api.together.ai/settings/api-keys",
		apiOrigins: ["https://api.together.xyz"],
		chatBaseUrl: "https://api.together.xyz/v1",
		keyTest: {
			url: "https://api.together.xyz/v1/models",
			auth: "bearer",
			// Together answers with a bare array.
			modelList: "array",
		},
		nativeIds: true,
	},
	fireworks: {
		name: "Fireworks",
		keyPageUrl: "https://app.fireworks.ai/settings/users/api-keys",
		apiOrigins: ["https://api.fireworks.ai"],
		chatBaseUrl: "https://api.fireworks.ai/inference/v1",
		keyTest: {
			url: "https://api.fireworks.ai/inference/v1/models",
			auth: "bearer",
			modelList: "data",
		},
		nativeIds: true,
	},
	moonshot: {
		name: "Moonshot",
		keyPageUrl: "https://platform.moonshot.ai/console/api-keys",
		apiOrigins: ["https://api.moonshot.ai"],
		chatBaseUrl: "https://api.moonshot.ai/v1",
		keyTest: {
			url: "https://api.moonshot.ai/v1/models",
			auth: "bearer",
			modelList: "data",
		},
		nativeIds: true,
	},
	cerebras: {
		name: "Cerebras",
		keyPageUrl: "https://cloud.cerebras.ai",
		apiOrigins: ["https://api.cerebras.ai"],
		chatBaseUrl: "https://api.cerebras.ai/v1",
		keyTest: {
			url: "https://api.cerebras.ai/v1/models",
			auth: "bearer",
			modelList: "data",
		},
		nativeIds: true,
	},
	openrouter: {
		name: "OpenRouter",
		keyPageUrl: "https://openrouter.ai/settings/keys",
		// Chat completions and the OAuth PKCE key exchange (roadmap 1.1).
		apiOrigins: ["https://openrouter.ai"],
		chatBaseUrl: "https://openrouter.ai/api/v1",
		// The model list is public, so the test uses an endpoint that needs the key.
		keyTest: { url: "https://openrouter.ai/api/v1/key", auth: "bearer" },
		nativeIds: false,
		publicApiUrl: "https://openrouter.ai/api/v1",
	},
	huggingface: {
		name: "Hugging Face",
		keyPageUrl: "https://huggingface.co/settings/tokens",
		// The router for chat; huggingface.co for the key test (the router's model list doesn't need a key).
		apiOrigins: ["https://router.huggingface.co", "https://huggingface.co"],
		chatBaseUrl: "https://router.huggingface.co/v1",
		keyTest: { url: "https://huggingface.co/api/whoami-v2", auth: "bearer" },
		nativeIds: true,
	},
	vercel: {
		name: "Vercel AI Gateway",
		keyPageUrl: "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%2Fapi-keys",
		apiOrigins: ["https://ai-gateway.vercel.sh"],
		// The model list is public, so the test uses an endpoint that needs the key.
		keyTest: { url: "https://ai-gateway.vercel.sh/v1/credits", auth: "bearer" },
		nativeIds: false,
		publicApiUrl: "https://ai-gateway.vercel.sh/v1",
	},
} as const satisfies Record<string, ProviderEntry>;

type Registry = typeof PROVIDER_REGISTRY;

export type ProviderId = keyof Registry;

/** Providers called through the OpenAI-compatible SDK: the ones with a `chatBaseUrl`. */
export type OpenAiCompatibleId = {
	[K in ProviderId]: Registry[K] extends { chatBaseUrl: string } ? K : never;
}[ProviderId];

/** Providers whose native model ids the catalog records. */
export type NativeIdProvider = {
	[K in ProviderId]: Registry[K] extends { nativeIds: true } ? K : never;
}[ProviderId];

/** Every provider id, in registry order (the order settings lists them in). */
export const PROVIDER_IDS = Object.keys(PROVIDER_REGISTRY) as ProviderId[];

/** The registry's entry for `id`, typed as the general shape (optional fields included). */
export function providerEntry(id: ProviderId): ProviderEntry {
	return PROVIDER_REGISTRY[id];
}
