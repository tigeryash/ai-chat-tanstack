import type { MetadataExtractor } from "@ai-sdk/openai-compatible";
import type { LanguageModelUsage, ProviderMetadata } from "ai";
import { z } from "@/lib/zod";
import type { ModelSelection } from "./model-selection";

// Which host answered a reply, and what it cost (roadmap 2.2b). OpenRouter names the upstream in each
// stream chunk (`provider`) and puts the real cost in the last one (`usage.cost`); AI Gateway reports
// its final provider and cost in provider metadata. Otherwise the cost is estimated from the host's
// catalog prices.

const NAME_MAX = 100;
const MAX_COST_USD = 10_000;

const openRouterChunk = z
	.object({
		provider: z.string().max(NAME_MAX).optional().catch(undefined),
		usage: z
			.object({
				cost: z.number().finite().nonnegative().optional().catch(undefined),
			})
			.loose()
			.nullish()
			.catch(null),
	})
	.loose();

/** Reads OpenRouter's `provider` and `usage.cost` into provider metadata under `openrouter`. */
export const openRouterMetadataExtractor: MetadataExtractor = {
	extractMetadata: async ({ parsedBody }) => {
		const parsed = openRouterChunk.safeParse(parsedBody);
		if (!parsed.success) return undefined;
		return {
			openrouter: {
				provider: parsed.data.provider ?? null,
				cost: parsed.data.usage?.cost ?? null,
			},
		};
	},
	createStreamExtractor: () => {
		let provider: string | undefined;
		let cost: number | undefined;
		return {
			processChunk(chunk) {
				const parsed = openRouterChunk.safeParse(chunk);
				if (!parsed.success) return;
				provider = parsed.data.provider ?? provider;
				cost = parsed.data.usage?.cost ?? cost;
			},
			buildMetadata: () =>
				provider === undefined && cost === undefined
					? undefined
					: { openrouter: { provider: provider ?? null, cost: cost ?? null } },
		};
	},
};

const reported = z.object({
	provider: z.string().max(NAME_MAX).nullish().catch(null),
	cost: z.coerce.number().finite().nonnegative().nullish().catch(null),
});

const gatewayMetadata = z
	.object({
		routing: z
			.object({
				finalProvider: z.string().max(NAME_MAX).optional().catch(undefined),
				resolvedProvider: z.string().max(NAME_MAX).optional().catch(undefined),
			})
			.loose()
			.optional()
			.catch(undefined),
		cost: z.coerce.number().finite().nonnegative().optional().catch(undefined),
	})
	.loose();

/** What a reply records about its host. */
export interface ReplyHost {
	/** The upstream that served it, as the router names it ("DeepInfra"). */
	host?: string;
	/** USD. */
	cost?: number;
	/** True when `cost` comes from catalog prices rather than the provider's bill. */
	costEstimated?: boolean;
}

function fromProvider(
	provider: ModelSelection["provider"],
	metadata: ProviderMetadata | undefined,
): { host?: string; cost?: number } {
	if (provider === "openrouter") {
		const parsed = reported.safeParse(metadata?.openrouter ?? {});
		return parsed.success
			? {
					host: parsed.data.provider ?? undefined,
					cost: parsed.data.cost ?? undefined,
				}
			: {};
	}
	if (provider === "vercel") {
		const parsed = gatewayMetadata.safeParse(metadata?.gateway ?? {});
		if (!parsed.success) return {};
		return {
			host:
				parsed.data.routing?.finalProvider ??
				parsed.data.routing?.resolvedProvider,
			cost: parsed.data.cost,
		};
	}
	return {};
}

const PER_MILLION = 1_000_000;

/** Tokens × the host's catalog prices; undefined without prices or usage. */
export function estimateCost(
	usage: Pick<LanguageModelUsage, "inputTokens" | "outputTokens"> | undefined,
	pricing: ModelSelection["pricing"],
): number | undefined {
	if (!usage || !pricing) return undefined;
	const { inputTokens, outputTokens } = usage;
	if (inputTokens === undefined && outputTokens === undefined) return undefined;
	if (
		(inputTokens && pricing.input === undefined) ||
		(outputTokens && pricing.output === undefined)
	) {
		return undefined;
	}
	return (
		((inputTokens ?? 0) * (pricing.input ?? 0) +
			(outputTokens ?? 0) * (pricing.output ?? 0)) /
		PER_MILLION
	);
}

/** The host and cost to record from a finished step. */
export function replyHostOf(
	selection: ModelSelection,
	step: {
		providerMetadata: ProviderMetadata | undefined;
		usage: LanguageModelUsage;
	},
): ReplyHost {
	const { host, cost } = fromProvider(
		selection.provider,
		step.providerMetadata,
	);
	const estimate =
		cost === undefined
			? estimateCost(step.usage, selection.pricing)
			: undefined;
	const total = cost ?? estimate;
	return {
		...(host ? { host } : {}),
		...(total !== undefined && total <= MAX_COST_USD ? { cost: total } : {}),
		...(estimate !== undefined ? { costEstimated: true } : {}),
	};
}
