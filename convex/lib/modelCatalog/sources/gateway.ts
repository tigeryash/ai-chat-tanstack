import { z } from "../../zod";
import { compact, secondsToMs, toPricing } from "../normalize";
import type { GatewayProvider, ModelRow } from "../validators";
import { fetchJson } from "./http";
import {
	dataArrayEnvelope,
	optionalNumber,
	optionalString,
	type Parsed,
	parseEach,
	stringList,
	tierList,
} from "./parse";

// Vercel AI Gateway's public catalog. No key needed.
export const GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";

export function gatewayEndpointsUrl(gatewayId: string): string {
	const path = gatewayId.split("/").map(encodeURIComponent).join("/");
	return `${GATEWAY_MODELS_URL}/${path}/endpoints`;
}

const coverage = z.enum(["all", "some", "none"]).catch("none");

const gatewayModelSchema = z.object({
	id: z.string().regex(/^[^/\s]+\/[^\s]+$/),
	type: z.string(),
	name: z.string().min(1),
	description: optionalString,
	owned_by: z.string().min(1),
	released: optionalNumber,
	context_window: optionalNumber,
	max_tokens: optionalNumber,
	knowledge: optionalString,
	zdr: coverage,
	no_training: coverage,
	tags: stringList,
	supported_parameters: stringList,
	reasoning_options: z
		.array(
			z.object({
				type: z.string(),
				values: z.array(z.string()).optional(),
				min: z.number().optional(),
				max: z.number().optional(),
			}),
		)
		.nullish()
		.catch(null),
	modalities: z
		.object({ input: z.array(z.string()), output: z.array(z.string()) })
		.nullish()
		.catch(null),
	deprecated_at: optionalNumber,
	pricing: z
		.object({
			input: optionalString,
			output: optionalString,
			input_cache_read: optionalString,
			input_cache_write: optionalString,
			input_tiers: tierList,
			output_tiers: tierList,
			varies_by_provider: z.boolean().nullish(),
		})
		.nullish(),
});

type GatewayModel = z.infer<typeof gatewayModelSchema>;

/** The Gateway-owned part of a row. Enrichment and curation fill in the rest. */
export type GatewayFields = Pick<
	ModelRow,
	| "gatewayId"
	| "name"
	| "developer"
	| "description"
	| "contextWindow"
	| "maxOutputTokens"
	| "pricing"
	| "releasedAt"
	| "knowledgeCutoff"
	| "inputModalities"
	| "outputModalities"
	| "tags"
	| "supportedParameters"
	| "reasoningOptions"
	| "zdr"
	| "noTraining"
	| "deprecatedAt"
>;

/** Language models only: image, video, embedding and speech models can't back a chat pane. */
export function parseGatewayModels(body: unknown): Parsed<GatewayFields> {
	const { data } = dataArrayEnvelope.parse(body);
	const parsed = parseEach(gatewayModelSchema, data);
	return {
		items: parsed.items
			.filter((model) => model.type === "language")
			.map(toGatewayFields),
		skipped: parsed.skipped,
	};
}

function toGatewayFields(model: GatewayModel): GatewayFields {
	const pricing = model.pricing;
	return compact({
		gatewayId: model.id,
		name: model.name,
		developer: model.owned_by,
		description: model.description ?? "",
		contextWindow: model.context_window ?? undefined,
		maxOutputTokens: model.max_tokens ?? undefined,
		pricing: pricing
			? toPricing({
					input: pricing.input,
					output: pricing.output,
					cacheRead: pricing.input_cache_read,
					cacheWrite: pricing.input_cache_write,
					inputTiers: pricing.input_tiers,
					outputTiers: pricing.output_tiers,
					variesByProvider: pricing.varies_by_provider,
				})
			: undefined,
		releasedAt: secondsToMs(model.released),
		knowledgeCutoff: model.knowledge ?? undefined,
		inputModalities: model.modalities?.input ?? ["text"],
		outputModalities: model.modalities?.output ?? ["text"],
		tags: model.tags ?? [],
		supportedParameters: model.supported_parameters ?? [],
		reasoningOptions: (model.reasoning_options ?? []).map((option) =>
			compact(option),
		),
		zdr: model.zdr,
		noTraining: model.no_training,
		deprecatedAt: model.deprecated_at ?? undefined,
	});
}

export async function fetchGatewayModels(): Promise<Parsed<GatewayFields>> {
	return parseGatewayModels(await fetchJson(GATEWAY_MODELS_URL));
}

const endpointSchema = z.object({
	provider_name: z.string().min(1),
	context_length: optionalNumber,
	max_completion_tokens: optionalNumber,
	uptime_last_1d: optionalNumber,
	has_zdr: z.boolean().nullish(),
	has_no_training: z.boolean().nullish(),
	quantization: optionalString,
	pricing: z
		.object({
			prompt: optionalString,
			completion: optionalString,
			input_cache_read: optionalString,
			input_cache_write: optionalString,
			prompt_tiers: tierList,
			completion_tiers: tierList,
		})
		.nullish(),
});

const endpointsEnvelope = z.object({
	data: z.object({ endpoints: z.array(z.unknown()) }),
});

/** Providers serving one Gateway model, sorted by name so reruns compare equal. */
export function parseGatewayEndpoints(body: unknown): GatewayProvider[] {
	const { data } = endpointsEnvelope.parse(body);
	return parseEach(endpointSchema, data.endpoints)
		.items.map(
			(endpoint): GatewayProvider =>
				compact({
					provider: endpoint.provider_name,
					pricing: endpoint.pricing
						? toPricing({
								input: endpoint.pricing.prompt,
								output: endpoint.pricing.completion,
								cacheRead: endpoint.pricing.input_cache_read,
								cacheWrite: endpoint.pricing.input_cache_write,
								inputTiers: endpoint.pricing.prompt_tiers,
								outputTiers: endpoint.pricing.completion_tiers,
							})
						: undefined,
					contextWindow: endpoint.context_length ?? undefined,
					maxOutputTokens: endpoint.max_completion_tokens ?? undefined,
					uptime1d: endpoint.uptime_last_1d ?? undefined,
					zdr: endpoint.has_zdr === true,
					noTraining: endpoint.has_no_training === true,
					quantization: endpoint.quantization ?? undefined,
				}),
		)
		.sort((a, b) => a.provider.localeCompare(b.provider));
}

export async function fetchGatewayEndpoints(
	gatewayId: string,
): Promise<GatewayProvider[]> {
	return parseGatewayEndpoints(await fetchJson(gatewayEndpointsUrl(gatewayId)));
}
