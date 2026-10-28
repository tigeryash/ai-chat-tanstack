import type { streamText } from "ai";
import type { AutoSort, ModelSelection } from "./model-selection";

// The router options a request carries (roadmap 2.2b): a pinned upstream, what Auto optimizes for and
// the no-training filter, in OpenRouter's provider routing (`provider` in the request body) or AI
// Gateway's `providerOptions.gateway`. Direct providers get none.

/** OpenRouter's `provider.sort`. "reliable" leaves its default load balancing, which avoids outages. */
const OPENROUTER_SORT: Record<AutoSort, string | undefined> = {
	reliable: undefined,
	cheapest: "price",
	fastest: "throughput",
};

/** AI Gateway's `sort`. */
const GATEWAY_SORT: Record<AutoSort, "cost" | "tps" | undefined> = {
	reliable: undefined,
	cheapest: "cost",
	fastest: "tps",
};

type ProviderOptions = NonNullable<
	Parameters<typeof streamText>[0]["providerOptions"]
>;

function openRouterOptions(selection: ModelSelection) {
	const sort = selection.sort && OPENROUTER_SORT[selection.sort];
	const provider = {
		...(selection.upstream
			? { order: [selection.upstream], allow_fallbacks: false }
			: {}),
		...(!selection.upstream && sort ? { sort } : {}),
		...(selection.noTraining ? { data_collection: "deny" } : {}),
	};
	return {
		...(Object.keys(provider).length > 0 ? { provider } : {}),
		// The final chunk then carries the request's real cost.
		usage: { include: true },
	};
}

function gatewayOptions(selection: ModelSelection) {
	const sort = selection.sort && GATEWAY_SORT[selection.sort];
	return {
		...(selection.upstream
			? { order: [selection.upstream], only: [selection.upstream] }
			: {}),
		...(!selection.upstream && sort ? { sort } : {}),
		...(selection.noTraining ? { disallowPromptTraining: true } : {}),
	};
}

/** `streamText`'s `providerOptions` for the selection, or undefined when it needs none. */
export function routingOptions(
	selection: ModelSelection,
): ProviderOptions | undefined {
	if (selection.provider === "openrouter") {
		return { openrouter: openRouterOptions(selection) };
	}
	if (selection.provider === "vercel") {
		const gateway = gatewayOptions(selection);
		return Object.keys(gateway).length > 0 ? { gateway } : undefined;
	}
	return undefined;
}
