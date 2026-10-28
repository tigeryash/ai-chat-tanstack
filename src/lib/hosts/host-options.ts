import type { AutoSort } from "@/lib/chat/model-selection";
import { isProviderId, type ProviderId } from "@/lib/keys/providers";
import type { CatalogModel } from "@/lib/models/catalog";
import {
	type EndpointStats,
	type HostFeatures,
	type HostHealth,
	providerKeyOf,
} from "./endpoint-stats";
import { hostKey, localHealth } from "./host-failures";
import type { HostPrefs } from "./host-prefs";
import type { HostData } from "./use-endpoints";

// Every host that can run a catalog model, for the picker's "Run with" list and for Auto (roadmap
// 2.2b). A host is one of the user's connections: OpenRouter or AI Gateway (routers, each with its
// own upstream providers) or a direct key. Pure: live data, local failures and prefs come in.

/** What the chat needs from a host. Today only images (an attached picture); tools come later. */
export interface ChatNeeds {
	images: boolean;
}

export interface Upstream extends EndpointStats {
	/** Why Auto skips it and the list flags it, e.g. "Can't read images". */
	excluded?: string;
}

export interface HostOption {
	provider: ProviderId;
	/** The provider's id for the model. */
	model: string;
	connected: boolean;
	router: boolean;
	/** Live data for a direct host, matched by provider. */
	stats?: EndpointStats;
	/** A router's upstream providers, when its live data has loaded. */
	upstreams?: Upstream[];
	/** Live status combined with this browser's recent failures. */
	health: HostHealth;
	pricing: { input?: number; output?: number };
	throughput?: number;
	latencyMs?: number;
	uptime?: number;
	features: HostFeatures;
	noTraining?: boolean;
	zdr?: boolean;
	excluded?: string;
}

/** Names a direct provider goes by in the routers' data, where it isn't its own id. */
const PROVIDER_KEYS: Partial<Record<ProviderId, string[]>> = {
	moonshot: ["moonshotai", "moonshot"],
	// A Gemini key is AI Studio: the Gateway's "google", OpenRouter's "Google AI Studio".
	google: ["aistudio"],
	vercel: [],
	openrouter: [],
};

function statsFor(
	provider: ProviderId,
	data: HostData,
): EndpointStats | undefined {
	const keys = PROVIDER_KEYS[provider] ?? [providerKeyOf(provider)];
	const find = (list: readonly EndpointStats[] | undefined) =>
		list?.find((endpoint) => keys.includes(endpoint.providerKey));
	return find(data.gateway) ?? find(data.openRouter);
}

const HEALTH_RANK: Record<HostHealth, number> = {
	up: 0,
	unknown: 1,
	slow: 2,
	down: 3,
};

/** The worse of the public status and this browser's own experience. */
export function worseHealth(live: HostHealth, local: HostHealth): HostHealth {
	if (local === "up") return live;
	return HEALTH_RANK[local] > HEALTH_RANK[live] ? local : live;
}

/** A router is as healthy as its best upstream that the chat can use. */
function routerHealth(upstreams: readonly Upstream[] | undefined): HostHealth {
	const usable = upstreams?.filter((upstream) => !upstream.excluded) ?? [];
	if (usable.length === 0) return "unknown";
	return usable.reduce<HostHealth>(
		(best, upstream) =>
			HEALTH_RANK[upstream.health] < HEALTH_RANK[best] ? upstream.health : best,
		"down",
	);
}

function exclusion(
	stats: Pick<EndpointStats, "features" | "noTraining"> | undefined,
	needs: ChatNeeds,
	prefs: HostPrefs,
): string | undefined {
	if (needs.images && stats?.features.images === false) {
		return "Can't read images";
	}
	if (prefs.noTrainingOnly && stats?.noTraining !== true) {
		return stats?.noTraining === false
			? "May train on prompts"
			: "Data policy unknown";
	}
	return undefined;
}

type Failures = Parameters<typeof localHealth>[0];

interface Inputs {
	model: Pick<
		CatalogModel,
		"gatewayId" | "nativeIds" | "openRouterId" | "pricing" | "inputModalities"
	>;
	connected: ReadonlySet<ProviderId>;
	data: HostData;
	failures: Failures;
	prefs: HostPrefs;
	needs: ChatNeeds;
	now?: number;
}

function upstreamsOf(
	provider: ProviderId,
	list: readonly EndpointStats[] | undefined,
	inputs: Inputs,
): Upstream[] | undefined {
	return list?.map((endpoint) => ({
		...endpoint,
		health: worseHealth(
			endpoint.health,
			localHealth(
				inputs.failures,
				hostKey(provider, endpoint.slug),
				inputs.now,
			),
		),
		excluded: exclusion(endpoint, inputs.needs, inputs.prefs),
	}));
}

const lowest = (values: (number | undefined)[]) => {
	const known = values.filter((value): value is number => value !== undefined);
	return known.length > 0 ? Math.min(...known) : undefined;
};
const highest = (values: (number | undefined)[]) => {
	const known = values.filter((value): value is number => value !== undefined);
	return known.length > 0 ? Math.max(...known) : undefined;
};

function routerOption(
	provider: "openrouter" | "vercel",
	model: string,
	list: readonly EndpointStats[] | undefined,
	inputs: Inputs,
): HostOption {
	const upstreams = upstreamsOf(provider, list, inputs);
	const fitting = upstreams?.filter((upstream) => !upstream.excluded) ?? [];
	// The summary describes what the router would actually use: upstreams that fit and are up.
	const usable = fitting.filter((upstream) => upstream.health !== "down");
	const cheapest = [...usable].sort(
		(a, b) => priceOf(a.pricing) - priceOf(b.pricing),
	)[0];
	const imageSupport = fitting.some((upstream) => upstream.features.images);
	return {
		provider,
		model,
		connected: inputs.connected.has(provider),
		router: true,
		upstreams,
		health: worseHealth(
			routerHealth(upstreams),
			localHealth(inputs.failures, provider, inputs.now),
		),
		pricing: cheapest?.pricing ?? inputs.model.pricing ?? {},
		throughput: highest(usable.map((upstream) => upstream.throughput)),
		latencyMs: lowest(usable.map((upstream) => upstream.latencyMs)),
		uptime: highest(usable.map((upstream) => upstream.uptime)),
		features: {
			images: upstreams
				? imageSupport
				: inputs.model.inputModalities.includes("image"),
		},
		// Enforced in the request (OpenRouter `data_collection: "deny"`, Gateway
		// `disallowPromptTraining`), so the router itself is fine under the filter.
		noTraining: inputs.prefs.noTrainingOnly ? true : undefined,
		excluded:
			upstreams && upstreams.length > 0 && fitting.length === 0
				? "No upstream fits this chat"
				: undefined,
	};
}

function directOption(
	provider: ProviderId,
	model: string,
	inputs: Inputs,
): HostOption {
	const stats = statsFor(provider, inputs.data);
	return {
		provider,
		model,
		connected: inputs.connected.has(provider),
		router: false,
		stats,
		health: worseHealth(
			stats?.health ?? "unknown",
			localHealth(inputs.failures, provider, inputs.now),
		),
		pricing: stats?.pricing ?? inputs.model.pricing ?? {},
		throughput: stats?.throughput,
		latencyMs: stats?.latencyMs,
		uptime: stats?.uptime,
		features: stats?.features ?? {},
		noTraining: stats?.noTraining,
		zdr: stats?.zdr,
		excluded: exclusion(stats, inputs.needs, inputs.prefs),
	};
}

/** Every host for the model, connected or not: OpenRouter, then direct keys, then AI Gateway. */
export function hostOptionsFor(inputs: Inputs): HostOption[] {
	const { model } = inputs;
	const options: HostOption[] = [];
	if (model.openRouterId) {
		options.push(
			routerOption(
				"openrouter",
				model.openRouterId,
				inputs.data.openRouter,
				inputs,
			),
		);
	}
	for (const native of model.nativeIds) {
		if (isProviderId(native.provider)) {
			options.push(directOption(native.provider, native.modelId, inputs));
		}
	}
	options.push(
		routerOption("vercel", model.gatewayId, inputs.data.gateway, inputs),
	);
	return options;
}

function priceOf(pricing: { input?: number; output?: number }): number {
	if (pricing.input === undefined && pricing.output === undefined) {
		return Number.POSITIVE_INFINITY;
	}
	return (pricing.input ?? 0) + (pricing.output ?? 0);
}

const SORTERS: Record<AutoSort, (a: HostOption, b: HostOption) => number> = {
	reliable: (a, b) =>
		HEALTH_RANK[a.health] - HEALTH_RANK[b.health] ||
		(b.uptime ?? 0) - (a.uptime ?? 0),
	cheapest: (a, b) =>
		priceOf(a.pricing) - priceOf(b.pricing) ||
		HEALTH_RANK[a.health] - HEALTH_RANK[b.health],
	fastest: (a, b) =>
		(b.throughput ?? -1) - (a.throughput ?? -1) ||
		HEALTH_RANK[a.health] - HEALTH_RANK[b.health],
};

/**
 * Auto's pick: a connected host that fits the chat and isn't down, best by `sort` (ties keep the list's
 * order). Falls back to any connected host that fits, then any connected host.
 */
export function autoHost(
	options: readonly HostOption[],
	sort: AutoSort,
): HostOption | undefined {
	const connected = options.filter((option) => option.connected);
	const fits = connected.filter((option) => !option.excluded);
	const up = fits.filter((option) => option.health !== "down");
	const pool = up.length > 0 ? up : fits.length > 0 ? fits : connected;
	return [...pool].sort(SORTERS[sort])[0];
}

/** What "Hide unavailable" leaves: connected hosts that aren't down. */
export function isAvailable(option: HostOption): boolean {
	return option.connected && option.health !== "down";
}
