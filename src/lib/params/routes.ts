import type { ChatProviderId } from "@/lib/chat/model-selection";
import type { EndpointKind } from "@/lib/local-endpoints/endpoints";
import { PARAM_IDS, type ParamId } from "./registry";

// Which settings each route can express at all (roadmap 2.4b), whatever the model. `mapping.ts` knows
// how to send every setting listed here for its route. A model's own support (`support.ts`) narrows
// this further.

/** Where a request goes: the provider, plus the server kind for a local model and the model's maker. */
export interface ParamRoute {
	provider: ChatProviderId;
	/** For local models: which server, since LM Studio, Ollama and others take different extras. */
	endpointKind?: EndpointKind;
	/** The catalog model's developer ("anthropic"), from its Gateway id. */
	developer?: string;
}

/** What every AI SDK provider maps from its own call settings. */
const STANDARD: readonly ParamId[] = [
	"temperature",
	"topP",
	"presencePenalty",
	"frequencyPenalty",
	"maxOutputTokens",
	"stopSequences",
	"seed",
	"reasoningEffort",
];

/**
 * Local servers through their OpenAI-compatible API. LM Studio documents `top_k` and `repeat_penalty`;
 * Ollama's `/v1` takes only OpenAI's own settings; a custom server is usually llama.cpp or vLLM, which
 * both take `top_k` and `min_p` (but name the repeat penalty differently, so it's left out). Context
 * length is a load-time setting in LM Studio and isn't read from Ollama's `/v1` requests, so no local
 * server gets one.
 */
const LOCAL: Readonly<Record<EndpointKind, readonly ParamId[]>> = {
	lmstudio: [
		"temperature",
		"topP",
		"topK",
		"repetitionPenalty",
		"presencePenalty",
		"frequencyPenalty",
		"maxOutputTokens",
		"stopSequences",
		"seed",
	],
	ollama: [
		"temperature",
		"topP",
		"presencePenalty",
		"frequencyPenalty",
		"maxOutputTokens",
		"stopSequences",
		"seed",
	],
	custom: [
		"temperature",
		"topP",
		"topK",
		"minP",
		"maxOutputTokens",
		"stopSequences",
		"seed",
	],
};

/** Thinking budgets go in each maker's own provider options, which only Anthropic and Google have. */
const BUDGET_DEVELOPERS = new Set(["anthropic", "google"]);

export function routeParams(route: ParamRoute): ReadonlySet<ParamId> {
	switch (route.provider) {
		case "local":
			return new Set(LOCAL[route.endpointKind ?? "custom"]);
		case "openrouter":
			return new Set(PARAM_IDS);
		case "vercel":
			return new Set<ParamId>([
				...STANDARD,
				"topK",
				...(BUDGET_DEVELOPERS.has(route.developer ?? "")
					? (["reasoningBudget"] as const)
					: []),
				...(route.developer === "openai" ? (["verbosity"] as const) : []),
			]);
		case "anthropic":
			// Anthropic has no penalties or seed (the SDK warns and drops them).
			return new Set<ParamId>([
				"temperature",
				"topP",
				"topK",
				"maxOutputTokens",
				"stopSequences",
				"reasoningEffort",
				"reasoningBudget",
			]);
		case "google":
			return new Set<ParamId>([...STANDARD, "topK", "reasoningBudget"]);
		case "openai":
			return new Set<ParamId>([...STANDARD, "verbosity"]);
		default:
			return new Set(STANDARD);
	}
}

/** The maker part of a Gateway id ("anthropic/claude-opus-5.5" → "anthropic"). */
export function developerOf(gatewayId: string | undefined): string | undefined {
	return gatewayId?.split("/")[0] || undefined;
}
