import { describe, expect, it } from "vitest";
import type { ProviderId } from "@/lib/keys/providers";
import { testCatalogModel } from "@/lib/models/test-catalog";
import {
	parseGatewayEndpoints,
	parseOpenRouterEndpoints,
	withPolicies,
} from "./endpoint-stats";
import { autoHost, type ChatNeeds, hostOptionsFor } from "./host-options";
import { DEFAULT_HOST_PREFS, type HostPrefs } from "./host-prefs";
import { resolveHost, selectionExtras } from "./resolve-host";
import {
	TEST_GATEWAY_ENDPOINTS,
	TEST_OPENROUTER_ENDPOINTS,
} from "./test-endpoints";

const ID = "deepseek/deepseek-v4.1-flash";
const model = testCatalogModel(ID);
if (!model) throw new Error("fixture missing");
const gateway = parseGatewayEndpoints(TEST_GATEWAY_ENDPOINTS[ID]);
const data = {
	openRouter: withPolicies(
		parseOpenRouterEndpoints(TEST_OPENROUTER_ENDPOINTS[ID]),
		gateway,
	),
	gateway,
	loading: false,
};
const NOW = 1_800_000_000_000;

function options(
	connected: ProviderId[],
	{
		prefs = DEFAULT_HOST_PREFS,
		needs = { images: false },
		failures = {},
		withData = true,
	}: {
		prefs?: HostPrefs;
		needs?: ChatNeeds;
		failures?: Parameters<typeof hostOptionsFor>[0]["failures"];
		withData?: boolean;
	} = {},
) {
	return hostOptionsFor({
		model: model as NonNullable<typeof model>,
		connected: new Set(connected),
		data: withData ? data : { loading: true },
		failures,
		prefs,
		needs,
		now: NOW,
	});
}

describe("host options", () => {
	it("lists OpenRouter, the direct keys, then AI Gateway, with live details", () => {
		const hosts = options(["openrouter"]);
		expect(hosts.map((host) => [host.provider, host.connected])).toEqual([
			["openrouter", true],
			["deepseek", false],
			["fireworks", false],
			["vercel", false],
		]);
		const fireworks = hosts[2];
		expect(fireworks).toMatchObject({
			model: "accounts/fireworks/models/deepseek-v4p1-flash",
			health: "up",
			pricing: { input: 0.12, output: 0.5 },
			throughput: 190,
			noTraining: true,
		});
		// A router is as good as its best upstream that's up: Baseten's speed, DeepInfra's price (Reka
		// is cheaper but down).
		expect(hosts[0]).toMatchObject({
			health: "up",
			throughput: 240,
			pricing: { input: 0.08, output: 0.3 },
		});
	});

	it("falls back to catalog prices with no live data", () => {
		const [openRouter] = options(["openrouter"], { withData: false });
		expect(openRouter).toMatchObject({
			health: "unknown",
			pricing: { input: 0.1, output: 0.4 },
			upstreams: undefined,
		});
	});

	it("Auto picks a connected host that's up, by the chosen sort", () => {
		const both: ProviderId[] = ["openrouter", "fireworks"];
		expect(autoHost(options(both), "reliable")?.provider).toBe("openrouter");
		expect(autoHost(options(both), "fastest")?.provider).toBe("openrouter");
		expect(
			autoHost(options(["fireworks", "deepseek"]), "cheapest")?.provider,
		).toBe("deepseek");
		expect(
			autoHost(options(["fireworks", "deepseek"]), "fastest")?.provider,
		).toBe("fireworks");
		expect(autoHost(options([]), "reliable")).toBeUndefined();
	});

	it("this browser's failures turn a host orange, then red, and Auto skips it", () => {
		const at = (offset: number) => ({ at: NOW - offset, status: 429 });
		const once = options(["openrouter", "fireworks"], {
			failures: { openrouter: [at(1000)] },
		});
		expect(once[0]?.health).toBe("slow");
		const often = options(["openrouter", "fireworks"], {
			failures: { openrouter: [at(3000), at(2000), at(1000)] },
		});
		expect(often[0]?.health).toBe("down");
		expect(autoHost(often, "reliable")?.provider).toBe("fireworks");
		// Old failures are forgotten.
		const old = options(["openrouter"], {
			failures: { openrouter: [at(60 * 60 * 1000)] },
		});
		expect(old[0]?.health).toBe("up");
	});

	it("the no-training filter excludes hosts that train or don't say", () => {
		const prefs = { ...DEFAULT_HOST_PREFS, noTrainingOnly: true };
		const hosts = options(["openrouter", "deepseek", "fireworks"], { prefs });
		const byProvider = Object.fromEntries(
			hosts.map((host) => [host.provider, host]),
		);
		expect(byProvider.deepseek?.excluded).toBe("May train on prompts");
		expect(byProvider.fireworks?.excluded).toBeUndefined();
		expect(byProvider.openrouter?.excluded).toBeUndefined();
		expect(
			byProvider.openrouter?.upstreams?.map((upstream) => [
				upstream.slug,
				upstream.excluded,
			]),
		).toEqual([
			["deepinfra/fp8", "May train on prompts"],
			["fireworks", undefined],
			["baseten", undefined],
			["reka", "Data policy unknown"],
		]);
		expect(autoHost(hosts, "cheapest")?.provider).not.toBe("deepseek");
	});

	it("flags hosts that can't read an attached image", () => {
		const hosts = options(["openrouter", "vercel"], {
			needs: { images: true },
		});
		expect(hosts.find((host) => host.provider === "vercel")?.excluded).toBe(
			"No upstream fits this chat",
		);
	});
});

describe("resolveHost", () => {
	const fireworksPinned = {
		provider: "fireworks",
		model: "accounts/fireworks/models/deepseek-v4p1-flash",
		gatewayId: ID,
		autoHost: false,
	} as const;

	it("keeps a pinned host the user still has a key for", () => {
		const resolved = resolveHost(
			fireworksPinned,
			model as NonNullable<typeof model>,
			options(["openrouter", "fireworks"]),
			"reliable",
		);
		expect(resolved.choice).toEqual(fireworksPinned);
	});

	it("moves a pinned host without a key, or an old choice, to a connected host", () => {
		for (const stored of [
			fireworksPinned,
			{ provider: "fireworks", model: "x", gatewayId: ID } as const,
		]) {
			const resolved = resolveHost(
				stored,
				model as NonNullable<typeof model>,
				options(["openrouter"]),
				"reliable",
			);
			expect(resolved.choice).toEqual({
				provider: "openrouter",
				model: ID,
				gatewayId: ID,
				autoHost: true,
			});
		}
	});

	it("with nothing connected, points at the host to connect", () => {
		const resolved = resolveHost(
			fireworksPinned,
			model as NonNullable<typeof model>,
			options([]),
			"reliable",
		);
		expect(resolved.choice.provider).toBe("deepseek");
	});

	it("adds Auto's sort, the privacy filter and the pinned upstream's prices", () => {
		const hosts = options(["openrouter"]);
		const pinned = resolveHost(
			{
				provider: "openrouter",
				model: ID,
				gatewayId: ID,
				upstream: "fireworks",
				autoHost: false,
			},
			model as NonNullable<typeof model>,
			hosts,
			"cheapest",
		);
		expect(
			selectionExtras(pinned, model as NonNullable<typeof model>, {
				...DEFAULT_HOST_PREFS,
				autoSort: "cheapest",
				noTrainingOnly: true,
			}),
		).toEqual({
			sort: undefined,
			noTraining: true,
			pricing: { input: 0.12, output: 0.5 },
		});
	});
});
