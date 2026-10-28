import { z } from "@/lib/zod";

// Live per-host facts for one model (roadmap 2.2b), parsed from OpenRouter's and AI Gateway's public
// endpoint APIs: `GET openrouter.ai/api/v1/models/{id}/endpoints` and
// `GET ai-gateway.vercel.sh/v1/models/{id}/endpoints`. Both are third-party data, so every field is
// validated and anything odd is dropped rather than shown.

/** green / orange / red; "unknown" when nothing reports on the host. */
export type HostHealth = "up" | "slow" | "down" | "unknown";

/** What a host can do with this model. Undefined: not reported. */
export interface HostFeatures {
	tools?: boolean;
	structuredOutput?: boolean;
	reasoning?: boolean;
	images?: boolean;
}

export interface EndpointStats {
	/**
	 * What the router routes by: OpenRouter's endpoint tag ("deepinfra/fp8", which its `provider.order`
	 * accepts) or the Gateway's provider slug ("baseten").
	 */
	slug: string;
	/** Display name, e.g. "DeepInfra (fp8)". */
	name: string;
	/** The provider's name without variant, for matching across sources ("deepinfra"). */
	providerKey: string;
	/** USD per million tokens. */
	pricing: { input?: number; output?: number };
	contextLength?: number;
	maxOutput?: number;
	/** Median time to first token, milliseconds. */
	latencyMs?: number;
	/** Median tokens per second. */
	throughput?: number;
	/** Percent of recent requests that succeeded. */
	uptime?: number;
	health: HostHealth;
	features: HostFeatures;
	/** Prompts are not used for training. Undefined: the source doesn't say. */
	noTraining?: boolean;
	/** Zero data retention. Undefined: the source doesn't say. */
	zdr?: boolean;
	quantization?: string;
}

type Source = "openrouter" | "gateway";

/**
 * Where OpenRouter and AI Gateway name one provider differently. OpenRouter's "Google" is Vertex and
 * "Google AI Studio" is the Gemini API; the Gateway's "google" is the Gemini API.
 */
const PROVIDER_ALIASES: Record<Source, Record<string, string>> = {
	openrouter: {
		amazonbedrock: "bedrock",
		claudeplatformonaws: "claudeaws",
		google: "vertex",
		googleaistudio: "aistudio",
		togetherai: "together",
	},
	gateway: {
		google: "aistudio",
		vertexanthropic: "vertex",
		togetherai: "together",
	},
};

/**
 * One key per provider across both sources: lowercase letters and digits, without a region suffix,
 * so "DeepInfra", "deep-infra" and "Azure (global)" match the Gateway's "deepinfra" and "azure".
 */
export function providerKeyOf(name: string, source?: Source): string {
	const key = name
		.replace(/\([^)]*\)/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
	return (source && PROVIDER_ALIASES[source][key]) || key;
}

const perToken = z
	.union([z.string(), z.number()])
	.transform((value) => Number(value))
	.pipe(z.number().finite().nonnegative())
	.optional()
	.catch(undefined);

const optionalNumber = z.number().finite().nonnegative().nullish().catch(null);

/** Either a plain number or a `{ p50 }` percentile object. */
const median = z
	.union([z.number(), z.object({ p50: z.number().nullish() }).loose()])
	.nullish()
	.catch(null)
	.transform((value) =>
		typeof value === "number" ? value : (value?.p50 ?? undefined),
	);

const pricingSchema = z
	.object({ prompt: perToken, completion: perToken })
	.loose()
	.optional()
	.catch(undefined);

const supported = z.array(z.string()).optional().catch(undefined);

const architecture = z
	.object({ input_modalities: z.array(z.string()).optional().catch(undefined) })
	.loose()
	.optional()
	.catch(undefined);

const openRouterEndpoint = z
	.object({
		provider_name: z.string().max(100),
		tag: z.string().max(100).optional(),
		context_length: optionalNumber,
		max_completion_tokens: optionalNumber,
		pricing: pricingSchema,
		quantization: z.string().max(40).nullish().catch(null),
		supported_parameters: supported,
		status: z.number().nullish().catch(null),
		uptime_last_30m: optionalNumber,
		latency_last_30m: median,
		throughput_last_30m: median,
	})
	.loose();

const gatewayEndpoint = z
	.object({
		provider_name: z.string().max(100),
		context_length: optionalNumber,
		max_completion_tokens: optionalNumber,
		pricing: pricingSchema,
		quantization: z.string().max(40).nullish().catch(null),
		supported_parameters: supported,
		tags: z.array(z.string()).optional().catch(undefined),
		status: z.number().nullish().catch(null),
		uptime_last_1h: optionalNumber,
		latency_last_1h: median,
		throughput_last_1h: median,
		has_zdr: z.boolean().optional().catch(undefined),
		has_no_training: z.boolean().optional().catch(undefined),
	})
	.loose();

/** Keeps the endpoints that parse; a bad one is skipped, not fatal. */
const endpointsResponse = <T extends z.ZodType>(endpoint: T) =>
	z.object({
		data: z
			.object({
				architecture,
				endpoints: z
					.array(z.unknown())
					.max(200)
					.transform((items) =>
						items.flatMap((item) => {
							const parsed = endpoint.safeParse(item);
							return parsed.success ? [parsed.data as z.infer<T>] : [];
						}),
					),
			})
			.loose(),
	});

const PER_MILLION = 1_000_000;
const toMillion = (perTokenPrice: number | undefined) =>
	perTokenPrice === undefined
		? undefined
		: Number((perTokenPrice * PER_MILLION).toFixed(4));

/** Below these an endpoint shows orange, and below DOWN_UPTIME red. */
const SLOW_UPTIME = 95;
const DOWN_UPTIME = 50;

export function healthOf(
	status: number | null | undefined,
	uptime: number | null | undefined,
): HostHealth {
	if (typeof uptime === "number") {
		if (uptime < DOWN_UPTIME) return "down";
		if (uptime < SLOW_UPTIME || (status ?? 0) < 0) return "slow";
		return "up";
	}
	if (status === null || status === undefined) return "unknown";
	return status < 0 ? "slow" : "up";
}

function featuresFrom(
	params: readonly string[] | undefined,
	images: boolean | undefined,
): HostFeatures {
	const has = params ? new Set(params) : undefined;
	return {
		tools: has?.has("tools"),
		structuredOutput: has
			? has.has("structured_outputs") || has.has("response_format")
			: undefined,
		reasoning: has
			? has.has("reasoning") || has.has("include_reasoning")
			: undefined,
		images,
	};
}

const QUANTIZATION_HIDDEN = new Set(["unknown", ""]);

function quantizationOf(value: string | null | undefined) {
	return value && !QUANTIZATION_HIDDEN.has(value) ? value : undefined;
}

/** OpenRouter's endpoints for one model. Throws on a response that isn't the expected shape. */
export function parseOpenRouterEndpoints(json: unknown): EndpointStats[] {
	const { data } = endpointsResponse(openRouterEndpoint).parse(json);
	const images = data.architecture?.input_modalities?.includes("image");
	const endpoints = data.endpoints.map((endpoint) => {
		const quantization = quantizationOf(endpoint.quantization);
		return {
			slug: endpoint.tag ?? providerKeyOf(endpoint.provider_name),
			name: endpoint.provider_name,
			providerKey: providerKeyOf(endpoint.provider_name, "openrouter"),
			pricing: {
				input: toMillion(endpoint.pricing?.prompt),
				output: toMillion(endpoint.pricing?.completion),
			},
			contextLength: endpoint.context_length ?? undefined,
			maxOutput: endpoint.max_completion_tokens ?? undefined,
			latencyMs: endpoint.latency_last_30m,
			throughput: endpoint.throughput_last_30m,
			uptime: endpoint.uptime_last_30m ?? undefined,
			health: healthOf(endpoint.status, endpoint.uptime_last_30m),
			features: featuresFrom(endpoint.supported_parameters, images),
			quantization,
		} satisfies EndpointStats;
	});
	return withDistinctNames(endpoints);
}

/** AI Gateway's endpoints for one model. Throws on a response that isn't the expected shape. */
export function parseGatewayEndpoints(json: unknown): EndpointStats[] {
	const { data } = endpointsResponse(gatewayEndpoint).parse(json);
	const modelImages = data.architecture?.input_modalities?.includes("image");
	return data.endpoints.map(
		(endpoint) =>
			({
				slug: endpoint.provider_name,
				name: endpoint.provider_name,
				providerKey: providerKeyOf(endpoint.provider_name, "gateway"),
				pricing: {
					input: toMillion(endpoint.pricing?.prompt),
					output: toMillion(endpoint.pricing?.completion),
				},
				contextLength: endpoint.context_length ?? undefined,
				maxOutput: endpoint.max_completion_tokens ?? undefined,
				latencyMs: endpoint.latency_last_1h,
				throughput: endpoint.throughput_last_1h,
				uptime: endpoint.uptime_last_1h ?? undefined,
				health: healthOf(endpoint.status, endpoint.uptime_last_1h),
				features: featuresFrom(
					endpoint.supported_parameters,
					endpoint.tags ? endpoint.tags.includes("vision") : modelImages,
				),
				noTraining: endpoint.has_no_training,
				zdr: endpoint.has_zdr,
				quantization: quantizationOf(endpoint.quantization),
			}) satisfies EndpointStats,
	);
}

/** OpenRouter lists one provider several times (fp8, fp4, "flex"); tell them apart by their tag. */
function withDistinctNames(endpoints: EndpointStats[]): EndpointStats[] {
	const counts = new Map<string, number>();
	for (const endpoint of endpoints) {
		counts.set(endpoint.name, (counts.get(endpoint.name) ?? 0) + 1);
	}
	return endpoints.map((endpoint) => {
		if ((counts.get(endpoint.name) ?? 0) < 2) return endpoint;
		const variant = endpoint.slug.split("/").slice(1).join(" ");
		return variant
			? { ...endpoint, name: `${endpoint.name} (${variant})` }
			: endpoint;
	});
}

/**
 * Adds the Gateway's data-policy flags to OpenRouter's endpoints by provider (OpenRouter's public
 * API doesn't publish them). A provider the Gateway doesn't serve keeps an unknown policy.
 */
export function withPolicies(
	endpoints: readonly EndpointStats[],
	policySource: readonly EndpointStats[] | undefined,
): EndpointStats[] {
	if (!policySource) return [...endpoints];
	const byProvider = new Map(
		policySource.map((endpoint) => [endpoint.providerKey, endpoint]),
	);
	return endpoints.map((endpoint) => {
		const policy = byProvider.get(endpoint.providerKey);
		return policy
			? { ...endpoint, noTraining: policy.noTraining, zdr: policy.zdr }
			: endpoint;
	});
}

/** The Gateway names providers by slug ("deepinfra"); show OpenRouter's name for one when it has it. */
export function withDisplayNames(
	endpoints: readonly EndpointStats[],
	nameSource: readonly EndpointStats[] | undefined,
): EndpointStats[] {
	const names = new Map(
		(nameSource ?? []).map((endpoint) => [
			endpoint.providerKey,
			endpoint.name.replace(/\s*\([^)]*\)$/, ""),
		]),
	);
	return endpoints.map((endpoint) => ({
		...endpoint,
		name:
			names.get(endpoint.providerKey) ??
			endpoint.name.charAt(0).toUpperCase() + endpoint.name.slice(1),
	}));
}
