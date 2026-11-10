import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";
import { MIN_PRECISIONS } from "./precision";

// Host preferences in Settings → Models & hosts (roadmap R2 S3, docs/settings-research.md "Host
// preferences detail"): hosts to skip, a minimum precision, and a price cap for Auto. They hold for
// every chat in this browser and are only kept here (localStorage); nothing goes to our servers. The
// request carries them to the user's own router (`routing-options.ts`), and Auto filters by them
// (`host-options.ts`).

export const HOST_FILTERS_KEY = "highelo-host-filters";

export const BLOCKED_HOSTS_MAX = 50;
const HOST_NAME_MAX = 60;
/** Per million tokens. Far above any real price; it only stops nonsense. */
export const PRICE_CAP_MAX = 10_000;

/** A host the user skips, named by host ("DeepInfra"), matched by its provider key ("deepinfra"). */
const blockedHostSchema = z.object({
	key: z
		.string()
		.min(1)
		.max(HOST_NAME_MAX)
		.regex(/^[a-z0-9]+$/),
	name: z.string().trim().min(1).max(HOST_NAME_MAX),
});
export type BlockedHost = z.infer<typeof blockedHostSchema>;

const price = z.number().finite().nonnegative().max(PRICE_CAP_MAX).optional();

/** USD per million tokens; a side left out has no cap. */
const priceCapSchema = z.object({ prompt: price, completion: price });
export type PriceCap = z.infer<typeof priceCapSchema>;

const hostFiltersSchema = z.object({
	blockedHosts: z.array(blockedHostSchema).max(BLOCKED_HOSTS_MAX),
	/** "any": no filter. Otherwise the lowest weight format a host may serve. */
	minPrecision: z.enum(MIN_PRECISIONS),
	priceCap: priceCapSchema,
});
export type HostFilters = z.infer<typeof hostFiltersSchema>;

export const DEFAULT_HOST_FILTERS: HostFilters = {
	blockedHosts: [],
	minPrecision: "any",
	priceCap: {},
};

const filters = createLocalStore<HostFilters>(
	HOST_FILTERS_KEY,
	hostFiltersSchema,
	DEFAULT_HOST_FILTERS,
);

export function updateHostFilters(change: Partial<HostFilters>): void {
	filters.write({ ...filters.read(), ...change });
}

export function useHostFilters() {
	return [filters.use(), updateHostFilters] as const;
}

/** The blocklist with `host` added, or unchanged if it's there already or full. */
export function withBlockedHost(
	list: readonly BlockedHost[],
	host: BlockedHost,
): BlockedHost[] {
	const parsed = blockedHostSchema.safeParse(host);
	if (!parsed.success || list.length >= BLOCKED_HOSTS_MAX) return [...list];
	if (list.some((entry) => entry.key === parsed.data.key)) return [...list];
	return [...list, parsed.data];
}

export function isBlocked(
	filters: Pick<HostFilters, "blockedHosts">,
	providerKey: string,
): boolean {
	return filters.blockedHosts.some((host) => host.key === providerKey);
}

export function hasPriceCap(cap: PriceCap): boolean {
	return cap.prompt !== undefined || cap.completion !== undefined;
}

/** A price above the cap on either side. Unknown prices pass, as they do at OpenRouter. */
export function overPriceCap(
	pricing: { input?: number; output?: number },
	cap: PriceCap,
): boolean {
	const over = (value: number | undefined, limit: number | undefined) =>
		value !== undefined && limit !== undefined && value > limit;
	return (
		over(pricing.input, cap.prompt) || over(pricing.output, cap.completion)
	);
}
