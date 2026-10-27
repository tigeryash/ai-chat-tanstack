// Providers a user can call directly with their own key (roadmap decision 3), for which the model
// catalog records each model's native id. OpenRouter ids come from OpenRouter's own catalog, and the
// AI Gateway id is the catalog row's id, so neither is listed here.
//
// Imported by Convex (convex/lib/modelCatalog), so keep this file free of `@/` imports.
export const NATIVE_ID_PROVIDERS = [
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
	"huggingface",
] as const;

export type NativeIdProvider = (typeof NATIVE_ID_PROVIDERS)[number];
