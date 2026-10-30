import { describe, expect, it } from "vitest";
import {
	healthOf,
	parseGatewayEndpoints,
	parseOpenRouterEndpoints,
	withPolicies,
} from "./endpoint-stats";
import {
	TEST_GATEWAY_ENDPOINTS,
	TEST_OPENROUTER_ENDPOINTS,
} from "./endpoints.fixtures";

const MODEL = "deepseek/deepseek-v4.1-flash";

describe("endpoint stats", () => {
	it("parses OpenRouter's endpoints: per-million prices, tags, health and features", () => {
		const endpoints = parseOpenRouterEndpoints(
			TEST_OPENROUTER_ENDPOINTS[MODEL],
		);
		expect(endpoints.map((endpoint) => endpoint.slug)).toEqual([
			"deepinfra/fp8",
			"fireworks",
			"baseten",
			"reka",
		]);
		expect(endpoints[0]).toMatchObject({
			name: "DeepInfra",
			providerKey: "deepinfra",
			pricing: { input: 0.08, output: 0.3 },
			latencyMs: 900,
			throughput: 60,
			health: "up",
			quantization: "fp8",
			features: {
				tools: true,
				structuredOutput: true,
				reasoning: true,
				images: false,
			},
		});
		expect(endpoints.map((endpoint) => endpoint.health)).toEqual([
			"up",
			"up",
			"slow",
			"down",
		]);
	});

	it("parses the Gateway's endpoints with their data policies", () => {
		const endpoints = parseGatewayEndpoints(TEST_GATEWAY_ENDPOINTS[MODEL]);
		expect(endpoints[0]).toMatchObject({
			slug: "fireworks",
			noTraining: true,
			zdr: true,
			latencyMs: 380,
			throughput: 190,
		});
	});

	it("skips endpoints it can't read and drops odd fields", () => {
		const endpoints = parseOpenRouterEndpoints({
			data: {
				endpoints: [
					{ provider_name: 42 },
					{
						provider_name: "Odd",
						pricing: { prompt: "free", completion: "-1" },
						uptime_last_30m: "high",
						latency_last_30m: { p50: 120 },
					},
				],
			},
		});
		expect(endpoints).toEqual([
			expect.objectContaining({
				name: "Odd",
				slug: "odd",
				pricing: { input: undefined, output: undefined },
				uptime: undefined,
				latencyMs: 120,
				health: "unknown",
			}),
		]);
		expect(() => parseGatewayEndpoints({ error: "nope" })).toThrow();
	});

	it("names repeated providers by their variant", () => {
		const endpoints = parseOpenRouterEndpoints({
			data: {
				endpoints: [
					{ provider_name: "DeepInfra", tag: "deepinfra/fp8" },
					{ provider_name: "DeepInfra", tag: "deepinfra/fp8/flex" },
				],
			},
		});
		expect(endpoints.map((endpoint) => endpoint.name)).toEqual([
			"DeepInfra (fp8)",
			"DeepInfra (fp8 flex)",
		]);
	});

	it("borrows the Gateway's policies for OpenRouter's upstreams by provider", () => {
		const merged = withPolicies(
			parseOpenRouterEndpoints(TEST_OPENROUTER_ENDPOINTS[MODEL]),
			parseGatewayEndpoints(TEST_GATEWAY_ENDPOINTS[MODEL]),
		);
		expect(
			merged.map((endpoint) => [endpoint.slug, endpoint.noTraining]),
		).toEqual([
			["deepinfra/fp8", false],
			["fireworks", true],
			["baseten", true],
			["reka", undefined],
		]);
	});

	it("turns status and uptime into a light", () => {
		expect(healthOf(0, 100)).toBe("up");
		expect(healthOf(0, 94)).toBe("slow");
		expect(healthOf(-2, 99)).toBe("slow");
		expect(healthOf(0, 40)).toBe("down");
		expect(healthOf(null, null)).toBe("unknown");
		expect(healthOf(-1, null)).toBe("slow");
	});
});
