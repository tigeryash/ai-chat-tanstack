import type { ChatCompletion, ProbeRequest } from "./probes";

// Cost of probe requests (roadmap 2.4a). Estimates are worst case: every probe is assumed to use
// its whole max_tokens, and input tokens are a generous character count. Actual spend comes from
// OpenRouter's `usage.cost` when it sends one.

/** USD per token, plus any flat per-request fee. */
export type UnitPricing = {
	inputPerToken: number;
	outputPerToken: number;
	perRequest: number;
};

const PER_MILLION = 1_000_000;
/** Chat-template tokens around the messages (role markers, BOS, …). */
const TEMPLATE_OVERHEAD_TOKENS = 16;
/** Real tokenizers average ~4 characters a token for English and JSON; 3 errs high. */
const CHARS_PER_TOKEN = 3;

/** From the catalog (`models.list`), which stores USD per million tokens. */
export function pricingFromCatalog(pricing?: {
	input?: number;
	output?: number;
}): UnitPricing | undefined {
	if (pricing?.input === undefined || pricing.output === undefined)
		return undefined;
	return {
		inputPerToken: pricing.input / PER_MILLION,
		outputPerToken: pricing.output / PER_MILLION,
		perRequest: 0,
	};
}

/** From OpenRouter's public model list, which stores USD per token as strings. */
export function pricingFromOpenRouter(pricing?: {
	prompt?: string;
	completion?: string;
	request?: string;
}): UnitPricing | undefined {
	const input = Number(pricing?.prompt);
	const output = Number(pricing?.completion);
	if (!Number.isFinite(input) || !Number.isFinite(output)) return undefined;
	if (input < 0 || output < 0) return undefined; // "-1" marks a router with variable pricing.
	const perRequest = Number(pricing?.request ?? 0);
	return {
		inputPerToken: input,
		outputPerToken: output,
		perRequest: Number.isFinite(perRequest) && perRequest > 0 ? perRequest : 0,
	};
}

/** Whichever is dearer, so the estimate never undershoots the route we actually call. */
export function dearerPricing(
	a: UnitPricing | undefined,
	b: UnitPricing | undefined,
): UnitPricing | undefined {
	if (!a || !b) return a ?? b;
	return {
		inputPerToken: Math.max(a.inputPerToken, b.inputPerToken),
		outputPerToken: Math.max(a.outputPerToken, b.outputPerToken),
		perRequest: Math.max(a.perRequest, b.perRequest),
	};
}

export function estimateInputTokens(request: ProbeRequest): number {
	const text = JSON.stringify({ messages: request.messages, ...request.extra });
	return Math.ceil(text.length / CHARS_PER_TOKEN) + TEMPLATE_OVERHEAD_TOKENS;
}

export function estimateRequestUsd(
	pricing: UnitPricing,
	request: ProbeRequest,
): number {
	return (
		estimateInputTokens(request) * pricing.inputPerToken +
		request.maxTokens * pricing.outputPerToken +
		pricing.perRequest
	);
}

/** What a finished request cost: OpenRouter's own figure, or tokens times price. */
export function actualRequestUsd(
	pricing: UnitPricing,
	usage: ChatCompletion["usage"],
	request: ProbeRequest,
): number {
	if (typeof usage?.cost === "number" && Number.isFinite(usage.cost))
		return usage.cost;
	if (
		usage?.prompt_tokens === undefined &&
		usage?.completion_tokens === undefined
	)
		return estimateRequestUsd(pricing, request);
	return (
		(usage.prompt_tokens ?? 0) * pricing.inputPerToken +
		(usage.completion_tokens ?? 0) * pricing.outputPerToken +
		pricing.perRequest
	);
}

export type ModelPlan = {
	gatewayId: string;
	pricing: UnitPricing | undefined;
	requests: readonly ProbeRequest[];
};

export type PlanEstimate = {
	models: { gatewayId: string; requests: number; usd: number }[];
	/** Models with no price anywhere. The run skips them rather than spend blind. */
	unpriced: string[];
	requests: number;
	totalUsd: number;
};

export function estimatePlan(plans: readonly ModelPlan[]): PlanEstimate {
	const models: PlanEstimate["models"] = [];
	const unpriced: string[] = [];
	for (const plan of plans) {
		const { pricing } = plan;
		if (!pricing) {
			unpriced.push(plan.gatewayId);
			continue;
		}
		const usd = plan.requests.reduce(
			(sum, request) => sum + estimateRequestUsd(pricing, request),
			0,
		);
		models.push({
			gatewayId: plan.gatewayId,
			requests: plan.requests.length,
			usd,
		});
	}
	return {
		models,
		unpriced,
		requests: models.reduce((sum, model) => sum + model.requests, 0),
		totalUsd: models.reduce((sum, model) => sum + model.usd, 0),
	};
}

/** The budget guard: send the next request only if its worst case still fits under the cap. */
export function fitsBudget(
	spentUsd: number,
	nextUsd: number,
	maxUsd: number,
): boolean {
	return spentUsd + nextUsd <= maxUsd;
}

export function formatUsd(usd: number): string {
	if (usd === 0) return "$0";
	if (usd < 0.0001) return "<$0.0001";
	return `$${usd.toFixed(usd < 0.01 ? 4 : 3)}`;
}
