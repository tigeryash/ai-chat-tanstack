import { describe, expect, it } from "vitest";
import {
	actualRequestUsd,
	dearerPricing,
	estimateInputTokens,
	estimatePlan,
	estimateRequestUsd,
	fitsBudget,
	formatUsd,
	pricingFromCatalog,
	pricingFromOpenRouter,
} from "./cost";
import type { ProbeRequest } from "./probes";

// $5 / $25 per million tokens, like a frontier model, so the numbers are easy to check.
const FRONTIER = { inputPerToken: 5e-6, outputPerToken: 25e-6, perRequest: 0 };
const HI: ProbeRequest = {
	messages: [{ role: "user", content: "Hi" }],
	maxTokens: 16,
	extra: {},
};

describe("pricing", () => {
	it("converts catalog prices from per-million", () => {
		expect(pricingFromCatalog({ input: 5, output: 25 })).toEqual(FRONTIER);
		expect(pricingFromCatalog({ input: 5 })).toBeUndefined();
		expect(pricingFromCatalog(undefined)).toBeUndefined();
	});

	it("reads OpenRouter's per-token strings and skips variable-price routers", () => {
		expect(
			pricingFromOpenRouter({
				prompt: "0.000005",
				completion: "0.000025",
				request: "0",
			}),
		).toEqual(FRONTIER);
		expect(
			pricingFromOpenRouter({
				prompt: "0.000001",
				completion: "0.000002",
				request: "0.001",
			})?.perRequest,
		).toBe(0.001);
		expect(
			pricingFromOpenRouter({ prompt: "-1", completion: "-1" }),
		).toBeUndefined();
		expect(pricingFromOpenRouter({})).toBeUndefined();
	});

	it("estimates at the dearer of two prices", () => {
		const cheap = {
			inputPerToken: 1e-6,
			outputPerToken: 30e-6,
			perRequest: 0.001,
		};
		expect(dearerPricing(FRONTIER, cheap)).toEqual({
			inputPerToken: 5e-6,
			outputPerToken: 30e-6,
			perRequest: 0.001,
		});
		expect(dearerPricing(undefined, cheap)).toBe(cheap);
	});
});

describe("estimates", () => {
	it("over-counts input tokens rather than under", () => {
		// '{"messages":[{"role":"user","content":"Hi"}]}' is 45 characters, ~12 real tokens.
		expect(estimateInputTokens(HI)).toBe(Math.ceil(45 / 3) + 16);
	});

	it("assumes the whole max_tokens is used", () => {
		const usd = estimateRequestUsd(FRONTIER, HI);
		expect(usd).toBeCloseTo(31 * 5e-6 + 16 * 25e-6, 10);
	});

	it("sums a plan and lists unpriced models separately", () => {
		const plan = estimatePlan([
			{ gatewayId: "a/one", pricing: FRONTIER, requests: [HI, HI] },
			{
				gatewayId: "b/free",
				pricing: { inputPerToken: 0, outputPerToken: 0, perRequest: 0 },
				requests: [HI],
			},
			{ gatewayId: "c/unknown", pricing: undefined, requests: [HI] },
		]);
		expect(plan.requests).toBe(3);
		expect(plan.unpriced).toEqual(["c/unknown"]);
		expect(plan.totalUsd).toBeCloseTo(2 * estimateRequestUsd(FRONTIER, HI), 10);
	});

	it("keeps a frontier model's full probe under a cent", () => {
		const plan = estimatePlan([
			{ gatewayId: "a/one", pricing: FRONTIER, requests: Array(16).fill(HI) },
		]);
		expect(plan.totalUsd).toBeLessThan(0.01);
	});
});

describe("actual spend and the budget", () => {
	it("prefers OpenRouter's own cost figure", () => {
		expect(
			actualRequestUsd(
				FRONTIER,
				{ prompt_tokens: 10, completion_tokens: 2, cost: 0.123 },
				HI,
			),
		).toBe(0.123);
	});

	it("falls back to tokens times price, then to the estimate", () => {
		expect(
			actualRequestUsd(
				FRONTIER,
				{ prompt_tokens: 10, completion_tokens: 2 },
				HI,
			),
		).toBeCloseTo(10 * 5e-6 + 2 * 25e-6, 10);
		expect(actualRequestUsd(FRONTIER, undefined, HI)).toBe(
			estimateRequestUsd(FRONTIER, HI),
		);
	});

	it("allows a request only if its worst case fits", () => {
		expect(fitsBudget(0.4, 0.1, 0.5)).toBe(true);
		expect(fitsBudget(0.45, 0.1, 0.5)).toBe(false);
	});

	it("formats small amounts readably", () => {
		expect(formatUsd(0)).toBe("$0");
		expect(formatUsd(0.00001)).toBe("<$0.0001");
		expect(formatUsd(0.0042)).toBe("$0.0042");
		expect(formatUsd(0.123)).toBe("$0.123");
	});
});
