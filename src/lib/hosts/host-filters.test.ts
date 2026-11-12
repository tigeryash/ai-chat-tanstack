import { describe, expect, it } from "vitest";
import { toSelection } from "@/lib/chat/model-selection";
import { routingOptions } from "@/lib/chat/routing-options";
import type { ProviderId } from "@/lib/keys/providers";
import { testCatalogModel } from "@/lib/models/catalog.fixtures";
import {
	parseGatewayEndpoints,
	parseOpenRouterEndpoints,
	withPolicies,
} from "./endpoint-stats";
import {
	TEST_GATEWAY_ENDPOINTS,
	TEST_OPENROUTER_ENDPOINTS,
} from "./endpoints.fixtures";
import {
	DEFAULT_HOST_FILTERS,
	type HostFilters,
	overPriceCap,
	withBlockedHost,
} from "./host-filters";
import { autoHost, expectedUpstream, hostOptionsFor } from "./host-options";
import { DEFAULT_HOST_PREFS } from "./host-prefs";
import { hostFromName } from "./known-hosts";
import {
	belowPrecision,
	gatewayQuantizationFilter,
	openRouterQuantizations,
} from "./precision";
import { resolveHost, selectionExtras } from "./resolve-host";

// Roadmap R2 S3: the host preferences (blocklist, minimum precision, price cap for Auto), how Auto
// filters by them, and what they map to in the request to OpenRouter and AI Gateway.

const ID = "deepseek/deepseek-v4.1-flash";
const found = testCatalogModel(ID);
if (!found) throw new Error("fixture missing");
const model = found;
const gateway = parseGatewayEndpoints(TEST_GATEWAY_ENDPOINTS[ID]);
const data = {
	openRouter: withPolicies(
		parseOpenRouterEndpoints(TEST_OPENROUTER_ENDPOINTS[ID]),
		gateway,
	),
	gateway,
	loading: false,
};

const blocking = (...names: string[]): HostFilters => ({
	...DEFAULT_HOST_FILTERS,
	blockedHosts: names.flatMap((name) => {
		const host = hostFromName(name);
		return host ? [host] : [];
	}),
});

function hosts(connected: ProviderId[], filters: HostFilters, withData = true) {
	return hostOptionsFor({
		model,
		connected: new Set(connected),
		data: withData ? data : { loading: true },
		failures: {},
		prefs: DEFAULT_HOST_PREFS,
		filters,
		needs: { images: false },
	});
}

/** What the request to the chat's host carries, as `streamText`'s `providerOptions`. */
function requestOptions(
	connected: ProviderId[],
	filters: HostFilters,
	stored: Parameters<typeof resolveHost>[0] = {
		provider: "openrouter",
		model: ID,
		gatewayId: ID,
		autoHost: true,
	},
	withData = true,
) {
	const options = hosts(connected, filters, withData);
	const resolved = resolveHost(stored, model, options, "reliable");
	const selection = toSelection(
		resolved.choice,
		selectionExtras(resolved, model, DEFAULT_HOST_PREFS, filters),
	);
	if (!selection) throw new Error("no selection");
	return routingOptions(selection);
}

const byProvider = (list: ReturnType<typeof hosts>) =>
	Object.fromEntries(list.map((host) => [host.provider, host]));

describe("precision", () => {
	it("ranks formats by bits; unknown formats pass", () => {
		expect(belowPrecision("fp4", "fp8")).toBe(true);
		expect(belowPrecision("int4", "fp8")).toBe(true);
		expect(belowPrecision("int8", "fp8")).toBe(false);
		expect(belowPrecision("FP8", "fp16")).toBe(true);
		expect(belowPrecision("bf16", "fp16")).toBe(false);
		expect(belowPrecision(undefined, "fp16")).toBe(false);
		expect(belowPrecision("something-new", "fp16")).toBe(false);
		expect(belowPrecision("fp4", "any")).toBe(false);
	});

	it("maps a minimum to OpenRouter's allowlist and the Gateway's negated filter", () => {
		expect(openRouterQuantizations("any")).toBeUndefined();
		expect(openRouterQuantizations("fp8")).toEqual([
			"int8",
			"fp8",
			"mxfp8",
			"fp16",
			"bf16",
			"fp32",
			"unknown",
		]);
		expect(openRouterQuantizations("fp16")).toEqual([
			"fp16",
			"bf16",
			"fp32",
			"unknown",
		]);
		expect(gatewayQuantizationFilter("any")).toBeUndefined();
		expect(gatewayQuantizationFilter("fp8")).toEqual([
			"!quantization:int4",
			"!quantization:fp4",
			"!quantization:mxfp4",
			"!quantization:nvfp4",
			"!quantization:fp6",
		]);
	});
});

describe("blocklist entries", () => {
	it("names hosts by host, matching the routers' and direct keys' names", () => {
		expect(hostFromName("deepinfra")).toEqual({
			key: "deepinfra",
			name: "DeepInfra",
		});
		expect(hostFromName("Together AI")?.key).toBe("together");
		expect(hostFromName("Some New Host")).toEqual({
			key: "somenewhost",
			name: "Some New Host",
		});
		expect(hostFromName("  ")).toBeUndefined();
	});

	it("adds a host once", () => {
		const one = withBlockedHost([], { key: "deepinfra", name: "DeepInfra" });
		expect(
			withBlockedHost(one, { key: "deepinfra", name: "deepinfra" }),
		).toEqual(one);
	});

	it("caps prices per side; unknown prices pass", () => {
		expect(overPriceCap({ input: 2, output: 1 }, { prompt: 1 })).toBe(true);
		expect(overPriceCap({ input: 1, output: 5 }, { prompt: 1 })).toBe(false);
		expect(overPriceCap({}, { prompt: 0, completion: 0 })).toBe(false);
	});
});

describe("Auto under the host preferences", () => {
	it("marks a blocked direct host and leaves it to a pin", () => {
		const list = byProvider(
			hosts(["openrouter", "fireworks"], blocking("Fireworks")),
		);
		expect(list.fireworks?.skipped).toBe("blocked");
		expect(list.fireworks?.excluded).toBeUndefined();
		// Fireworks is the fastest of the two direct hosts; blocked, Auto takes DeepSeek.
		const direct = hosts(["fireworks", "deepseek"], blocking("Fireworks"));
		expect(autoHost(direct, "fastest")?.provider).toBe("deepseek");
		// A pinned blocked host still runs.
		const pinned = resolveHost(
			{
				provider: "fireworks",
				model: "accounts/fireworks/models/deepseek-v4p1-flash",
				gatewayId: ID,
				autoHost: false,
			},
			model,
			direct,
			"fastest",
		);
		expect(pinned.choice.provider).toBe("fireworks");
	});

	it("with only skipped hosts connected, Auto still runs on one", () => {
		const only = hosts(["fireworks"], blocking("Fireworks"));
		expect(autoHost(only, "reliable")?.provider).toBe("fireworks");
	});

	it("marks blocked, quantized and over-cap upstreams, and Auto's expected upstream moves", () => {
		const [openRouter] = hosts(["openrouter"], DEFAULT_HOST_FILTERS);
		expect(expectedUpstream(openRouter?.upstreams, "reliable")?.slug).toBe(
			"deepinfra/fp8",
		);
		const [filtered] = hosts(["openrouter"], {
			blockedHosts: [{ key: "fireworks", name: "Fireworks" }],
			minPrecision: "fp16",
			priceCap: { completion: 1 },
		});
		expect(
			filtered?.upstreams?.map((upstream) => [upstream.slug, upstream.skipped]),
		).toEqual([
			["deepinfra/fp8", "precision"],
			["fireworks", "blocked"],
			["baseten", "price"],
			["reka", undefined],
		]);
		// Reka is down, so nothing is expected; the router itself is still usable.
		expect(expectedUpstream(filtered?.upstreams, "reliable")).toBeUndefined();
		expect(filtered?.skipped).toBeUndefined();
	});

	it("skips a router when every upstream is skipped", () => {
		const [openRouter] = hosts(["openrouter", "fireworks"], {
			...DEFAULT_HOST_FILTERS,
			priceCap: { prompt: 0.01 },
		});
		expect(openRouter?.skipped).toBe("price");
	});
});

describe("request mapping", () => {
	it("sends nothing extra with no preferences", () => {
		expect(requestOptions(["openrouter"], DEFAULT_HOST_FILTERS)).toEqual({
			openrouter: { usage: { include: true } },
		});
	});

	it("maps all three to OpenRouter's provider routing", () => {
		const options = requestOptions(["openrouter"], {
			blockedHosts: [
				{ key: "deepinfra", name: "DeepInfra" },
				{ key: "groq", name: "Groq" },
			],
			minPrecision: "fp8",
			priceCap: { prompt: 1, completion: 2 },
		});
		expect(options?.openrouter?.provider).toEqual({
			// Only DeepInfra serves this model there; its live slug, not "deepinfra/fp8".
			ignore: ["deepinfra"],
			quantizations: openRouterQuantizations("fp8"),
			max_price: { prompt: 1, completion: 2 },
		});
	});

	it("before live data loads, ignores the blocked hosts by their own slugs", () => {
		const options = requestOptions(
			["openrouter"],
			blocking("DeepInfra", "Amazon Bedrock"),
			undefined,
			false,
		);
		expect(options?.openrouter?.provider).toEqual({
			ignore: ["deepinfra", "amazon-bedrock"],
		});
	});

	it("leaves out an uncapped side of the price cap", () => {
		const options = requestOptions(["openrouter"], {
			...DEFAULT_HOST_FILTERS,
			priceCap: { completion: 2 },
		});
		expect(options?.openrouter?.provider).toEqual({
			max_price: { completion: 2 },
		});
	});

	it("filters AI Gateway's upstreams into `only`, and quantization into `has`", () => {
		const options = requestOptions(
			["vercel"],
			{
				blockedHosts: [{ key: "deepinfra", name: "DeepInfra" }],
				minPrecision: "fp8",
				priceCap: { completion: 1 },
			},
			{ provider: "vercel", model: ID, gatewayId: ID, autoHost: true },
		);
		expect(options?.gateway).toEqual({
			only: ["fireworks", "deepseek"],
			has: gatewayQuantizationFilter("fp8"),
		});
	});

	it("a pinned upstream carries none of them: pinning runs it", () => {
		const options = requestOptions(
			["openrouter"],
			{
				blockedHosts: [{ key: "deepinfra", name: "DeepInfra" }],
				minPrecision: "fp16",
				priceCap: { prompt: 0.01 },
			},
			{
				provider: "openrouter",
				model: ID,
				gatewayId: ID,
				upstream: "deepinfra/fp8",
				autoHost: false,
			},
		);
		expect(options?.openrouter?.provider).toEqual({
			order: ["deepinfra/fp8"],
			allow_fallbacks: false,
		});
	});

	it("direct hosts get no router options", () => {
		expect(
			requestOptions(["fireworks"], blocking("Fireworks"), {
				provider: "fireworks",
				model: "accounts/fireworks/models/deepseek-v4p1-flash",
				gatewayId: ID,
				autoHost: false,
			}),
		).toBeUndefined();
	});
});
