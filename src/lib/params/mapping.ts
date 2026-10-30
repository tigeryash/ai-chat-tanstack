import type { streamText } from "ai";
import { type ParamRoute, routeParams } from "./routes";
import type { ParamValues } from "./settings";
import type { ParamSupport } from "./support";

// Turns a chat's settings into `streamText` options for its route (roadmap 2.4b, decision 15). Only
// what `support` allows goes out, so a setting the model or host doesn't take is stripped here, in
// the transport, whatever the panel showed. AI SDK call settings cover what every provider maps
// itself; the rest goes in `providerOptions`:
// - OpenRouter and local servers speak OpenAI's API through `@ai-sdk/openai-compatible`, which copies
//   unknown keys of `providerOptions[<provider name>]` into the request body (`top_k`, `min_p`, …).
// - Anthropic and Google thinking budgets go in their own provider options, also through AI Gateway,
//   which forwards them to the maker.
// - OpenAI's verbosity is `textVerbosity` in the `openai` options.

type StreamTextOptions = Parameters<typeof streamText>[0];
export type ProviderOptions = NonNullable<StreamTextOptions["providerOptions"]>;
type ProviderOptionsEntry = ProviderOptions[string];

export type CallSettings = Pick<
	StreamTextOptions,
	| "temperature"
	| "topP"
	| "topK"
	| "presencePenalty"
	| "frequencyPenalty"
	| "maxOutputTokens"
	| "stopSequences"
	| "seed"
	| "reasoning"
>;

export interface CallParams {
	settings: CallSettings;
	providerOptions?: ProviderOptions;
}

/** Drops anything `support` doesn't allow, and any value outside what the model offers. */
export function allowedValues(
	values: ParamValues,
	support: ParamSupport,
): ParamValues {
	const allowed = Object.fromEntries(
		Object.entries(values).filter(([id, value]) => {
			if (value === undefined) return false;
			if (!support.params.includes(id as keyof ParamValues)) return false;
			if (id === "reasoningEffort") {
				return support.reasoningEfforts.includes(
					value as ParamValues["reasoningEffort"] & string,
				);
			}
			if (id === "reasoningBudget") {
				const range = support.reasoningBudget;
				return (
					range !== undefined &&
					(value as number) >= range.min &&
					(value as number) <= range.max
				);
			}
			if (id === "stopSequences") return (value as string[]).length > 0;
			return true;
		}),
	) as ParamValues;
	// A budget turns thinking on at that size; sending an effort too would contradict it.
	if (allowed.reasoningBudget !== undefined) delete allowed.reasoningEffort;
	return allowed;
}

/** Keys an OpenAI-compatible route sends as they are, in OpenRouter's or the local server's names. */
function openAiCompatibleExtras(
	route: ParamRoute,
	values: ParamValues,
): ProviderOptionsEntry {
	const openRouter = route.provider === "openrouter";
	const reasoning =
		values.reasoningBudget !== undefined
			? { max_tokens: values.reasoningBudget }
			: values.reasoningEffort !== undefined
				? { effort: values.reasoningEffort }
				: undefined;
	return {
		...(values.topK !== undefined && { top_k: values.topK }),
		...(values.minP !== undefined && { min_p: values.minP }),
		...(values.repetitionPenalty !== undefined && {
			// LM Studio (and llama.cpp) call it `repeat_penalty`.
			[openRouter ? "repetition_penalty" : "repeat_penalty"]:
				values.repetitionPenalty,
		}),
		// OpenRouter's own reasoning object, the one the probe tested.
		...(openRouter && reasoning && { reasoning }),
		...(openRouter &&
			values.verbosity !== undefined && { verbosity: values.verbosity }),
	};
}

function makerOptions(route: ParamRoute, values: ParamValues): ProviderOptions {
	const maker =
		route.provider === "vercel" ? route.developer : (route.provider as string);
	const options: ProviderOptions = {};
	if (values.reasoningBudget !== undefined) {
		if (maker === "anthropic") {
			options.anthropic = {
				thinking: { type: "enabled", budgetTokens: values.reasoningBudget },
			};
		} else if (maker === "google") {
			options.google = {
				thinkingConfig: { thinkingBudget: values.reasoningBudget },
			};
		}
	}
	if (values.verbosity !== undefined && maker === "openai") {
		options.openai = { textVerbosity: values.verbosity };
	}
	return options;
}

export function toCallParams(
	route: ParamRoute,
	values: ParamValues,
	support: ParamSupport,
): CallParams {
	// The support came from the panel; checking it against the route too means a stale one can't send
	// a setting this route has no way to express.
	const routeAllows = routeParams(route);
	const allowed = allowedValues(values, {
		...support,
		params: support.params.filter((id) => routeAllows.has(id)),
	});
	const openAiCompatible =
		route.provider === "openrouter" || route.provider === "local";
	const settings: CallSettings = {
		temperature: allowed.temperature,
		topP: allowed.topP,
		presencePenalty: allowed.presencePenalty,
		frequencyPenalty: allowed.frequencyPenalty,
		maxOutputTokens: allowed.maxOutputTokens,
		stopSequences: allowed.stopSequences,
		seed: allowed.seed,
		// `@ai-sdk/openai-compatible` drops `topK`, so those routes send `top_k` themselves.
		...(!openAiCompatible && { topK: allowed.topK }),
		...(route.provider !== "openrouter" &&
			allowed.reasoningBudget === undefined && {
				reasoning: allowed.reasoningEffort,
			}),
	};
	const providerOptions = openAiCompatible
		? { [route.provider]: openAiCompatibleExtras(route, allowed) }
		: makerOptions(route, allowed);
	return {
		settings: withoutUndefined(settings),
		providerOptions: withoutEmpty(providerOptions),
	};
}

function withoutUndefined<T extends object>(value: T): T {
	return Object.fromEntries(
		Object.entries(value).filter(([, entry]) => entry !== undefined),
	) as T;
}

function withoutEmpty(options: ProviderOptions): ProviderOptions | undefined {
	const kept = Object.entries(options).filter(
		([, entry]) => Object.keys(entry).length > 0,
	);
	return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

/** Both sets of provider options, merged one level deep (per provider). */
export function mergeProviderOptions(
	...all: (ProviderOptions | undefined)[]
): ProviderOptions | undefined {
	const merged: Record<string, ProviderOptionsEntry> = {};
	for (const options of all) {
		for (const [provider, entry] of Object.entries(options ?? {})) {
			merged[provider] = { ...merged[provider], ...entry };
		}
	}
	return Object.keys(merged).length > 0 ? merged : undefined;
}
