// Number and date formats for the model picker and card (roadmap 2.2).

/** 1_000_000 → "1M", 200_000 → "200K". */
export function formatTokens(tokens: number | undefined): string | undefined {
	if (tokens === undefined) return undefined;
	if (tokens >= 1_000_000) {
		return `${Number((tokens / 1_000_000).toFixed(1))}M`;
	}
	if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
	return String(tokens);
}

/** USD per million tokens: "$3", "$0.25", "Free". */
export function formatPrice(
	perMillion: number | undefined,
): string | undefined {
	if (perMillion === undefined) return undefined;
	if (perMillion === 0) return "Free";
	const digits = perMillion < 1 ? 3 : 2;
	return `$${Number(perMillion.toFixed(digits))}`;
}

const MONTH_YEAR = new Intl.DateTimeFormat("en", {
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});

/** Epoch milliseconds → "Aug 2026". */
export function formatMonth(at: number | undefined): string | undefined {
	return at === undefined ? undefined : MONTH_YEAR.format(at);
}

/** The Gateway's "2025-04" or "2025-07-31" → "Apr 2025". Anything else is shown as given. */
export function formatCutoff(cutoff: string | undefined): string | undefined {
	if (!cutoff) return undefined;
	const match = /^(\d{4})-(\d{2})/.exec(cutoff);
	if (!match) return cutoff;
	return MONTH_YEAR.format(Date.UTC(Number(match[1]), Number(match[2]) - 1));
}

/** USD for one reply, which is often a tiny fraction of a cent: "$0.000021", "$0.0012", "$0.42". */
export function formatCost(usd: number | undefined): string | undefined {
	if (usd === undefined) return undefined;
	if (usd === 0) return "$0";
	if (usd < 0.000001) return "<$0.000001";
	if (usd < 0.01)
		return `$${Number(usd.toPrecision(2)).toFixed(Math.min(8, 1 - Math.floor(Math.log10(usd))))}`;
	return `$${usd.toFixed(2)}`;
}

/** Tokens per second: "240 tok/s". */
export function formatSpeed(tokensPerSecond: number | undefined) {
	return tokensPerSecond === undefined
		? undefined
		: `${Math.round(tokensPerSecond)} tok/s`;
}

/** Time to first token: "700 ms", "2.6 s". */
export function formatLatency(ms: number | undefined) {
	if (ms === undefined) return undefined;
	return ms < 1000
		? `${Math.round(ms)} ms`
		: `${Number((ms / 1000).toFixed(1))} s`;
}

/** Uptime percent: "99.9%". */
export function formatUptime(percent: number | undefined) {
	return percent === undefined ? undefined : `${Number(percent.toFixed(1))}%`;
}
