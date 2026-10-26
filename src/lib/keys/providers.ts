// The providers a user can add a key for (roadmap decision 3: model calls go browser → provider).
// Each one's API origin is in the CSP allowlist (src/lib/security/provider-origins.ts); a key is only
// ever sent to its own provider's origin.

export const PROVIDER_IDS = [
	"openai",
	"anthropic",
	"google",
	"xai",
	"mistral",
	"deepseek",
	"groq",
	"together",
	"fireworks",
	"moonshot",
	"cerebras",
	"openrouter",
	"huggingface",
	"vercel",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export interface ProviderInfo {
	name: string;
	/** Where the user creates a key. Opened in a new tab, never fetched. */
	keyPageUrl: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
	openai: {
		name: "OpenAI",
		keyPageUrl: "https://platform.openai.com/api-keys",
	},
	anthropic: {
		name: "Anthropic",
		keyPageUrl: "https://platform.claude.com/settings/keys",
	},
	google: {
		name: "Google Gemini",
		keyPageUrl: "https://aistudio.google.com/app/apikey",
	},
	xai: { name: "xAI", keyPageUrl: "https://console.x.ai" },
	mistral: {
		name: "Mistral",
		keyPageUrl: "https://console.mistral.ai/api-keys",
	},
	deepseek: {
		name: "DeepSeek",
		keyPageUrl: "https://platform.deepseek.com/api_keys",
	},
	groq: { name: "Groq", keyPageUrl: "https://console.groq.com/keys" },
	together: {
		name: "Together AI",
		keyPageUrl: "https://api.together.ai/settings/api-keys",
	},
	fireworks: {
		name: "Fireworks",
		keyPageUrl: "https://app.fireworks.ai/settings/users/api-keys",
	},
	moonshot: {
		name: "Moonshot",
		keyPageUrl: "https://platform.moonshot.ai/console/api-keys",
	},
	cerebras: { name: "Cerebras", keyPageUrl: "https://cloud.cerebras.ai" },
	openrouter: {
		name: "OpenRouter",
		keyPageUrl: "https://openrouter.ai/settings/keys",
	},
	huggingface: {
		name: "Hugging Face",
		keyPageUrl: "https://huggingface.co/settings/tokens",
	},
	vercel: {
		name: "Vercel AI Gateway",
		keyPageUrl: "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%2Fapi-keys",
	},
};

export function isProviderId(value: unknown): value is ProviderId {
	return (
		typeof value === "string" &&
		(PROVIDER_IDS as readonly string[]).includes(value)
	);
}
