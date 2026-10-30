import type { Pricing } from "./validators";

/** "Claude Opus 4.5" / "claude-opus-4.5" / "Qwen/Qwen3.6-27B" → "claude-opus-4-5" / "qwen-qwen3-6-27b". */
export function normalizeSlug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** The model part of a "creator/model" id. */
export function modelPart(id: string): string {
	const slash = id.indexOf("/");
	return slash === -1 ? id : id.slice(slash + 1);
}

/** The last path segment: "accounts/fireworks/models/qwen3p8-max" → "qwen3p8-max". */
export function lastSegment(id: string): string {
	return id.slice(id.lastIndexOf("/") + 1);
}

/** Fireworks writes version dots as "p": "qwen3p8-max" means "qwen3.8-max". */
export function undoFireworksDecimals(value: string): string {
	return value.replace(/(\d)p(\d)/g, "$1.$2");
}

/**
 * Gateway suffixes for another way of serving the same weights (priority speed, batch API, free tier).
 * Scores belong to the weights, so these variants inherit the base model's.
 */
const SERVING_VARIANT_SUFFIX = /-(?:batch|fast|highspeed|free)$/;

export function stripServingVariant(slug: string): string {
	return slug.replace(SERVING_VARIANT_SUFFIX, "");
}

/** Filler words that differ between catalogs without naming a different model. */
const FILLER_TOKENS = new Set(["instruct", "it", "chat"]);

/**
 * Order-insensitive key for names that list the same parts in another order:
 * "claude-sonnet-4.5" and "claude-4-5-sonnet" both give "4 5 claude sonnet".
 * Letters and digits are split ("qwen3" → "qwen 3") so "qwen-3-14b" meets "qwen3-14b-instruct".
 */
export function tokenKey(value: string): string {
	return normalizeSlug(value)
		.replace(/([a-z])(\d)/g, "$1-$2")
		.replace(/(\d)([a-z])/g, "$1-$2")
		.split("-")
		.filter((token) => token.length > 0 && !FILLER_TOKENS.has(token))
		.sort()
		.join(" ");
}

/** A price per token as the sources send it ("0.000003") → USD per million tokens (3). */
export function perMillionTokens(
	value: string | number | null | undefined,
): number | undefined {
	if (value === null || value === undefined || value === "") return undefined;
	const perToken = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(perToken) || perToken < 0) return undefined;
	// Rounded so 0.00000012 × 1e6 is 0.12, not 0.12000000000000001.
	return Number.parseFloat((perToken * 1_000_000).toFixed(6));
}

export type RawTier = {
	cost: string;
	min?: number | null;
	max?: number | null;
};

export type RawPricing = {
	input?: string | null;
	output?: string | null;
	cacheRead?: string | null;
	cacheWrite?: string | null;
	inputTiers?: readonly RawTier[] | null;
	outputTiers?: readonly RawTier[] | null;
	variesByProvider?: boolean | null;
};

/** Both the model list and the endpoints list price per token; this is the shape we store. */
export function toPricing(raw: RawPricing): Pricing | undefined {
	const pricing: Pricing = {
		input: perMillionTokens(raw.input),
		output: perMillionTokens(raw.output),
		cacheRead: perMillionTokens(raw.cacheRead),
		cacheWrite: perMillionTokens(raw.cacheWrite),
		tiers: toTiers(raw.inputTiers ?? [], raw.outputTiers ?? []),
		variesByProvider: raw.variesByProvider === true ? true : undefined,
	};
	const stored = compact(pricing);
	return Object.keys(stored).length > 0 ? stored : undefined;
}

/** Tiers above the first one, merged by where they start. The first tier is the base price. */
function toTiers(
	inputTiers: readonly RawTier[],
	outputTiers: readonly RawTier[],
): Pricing["tiers"] {
	const byStart = new Map<number, { input?: number; output?: number }>();
	for (const { min, cost } of inputTiers) {
		if (min)
			byStart.set(min, { ...byStart.get(min), input: perMillionTokens(cost) });
	}
	for (const { min, cost } of outputTiers) {
		if (min)
			byStart.set(min, { ...byStart.get(min), output: perMillionTokens(cost) });
	}
	if (byStart.size === 0) return undefined;
	return [...byStart.entries()]
		.sort(([a], [b]) => a - b)
		.map(([minPromptTokens, prices]) =>
			compact({ minPromptTokens, ...prices }),
		);
}

/** Drops `undefined` fields, so stored rows compare equal however they were built. */
export function compact<T extends object>(value: T): T {
	return Object.fromEntries(
		Object.entries(value).filter(([, field]) => field !== undefined),
	) as T;
}

/** Unix seconds → milliseconds; anything else → undefined. */
export function secondsToMs(
	value: number | null | undefined,
): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value * 1000
		: undefined;
}
