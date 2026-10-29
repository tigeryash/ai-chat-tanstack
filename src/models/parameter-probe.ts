// Types for the parameter probe results (roadmap 2.4a, decision 15). The data lives in
// `parameter-probe.generated.ts`, written by `bun scripts/probe-params.ts`; don't edit that by hand.
// The settings panel (2.4b) shows a control only when its parameter is "accepted" here, or when the
// model was never probed and the catalog lists it.
//
// Imported by Convex (through curation.ts), so keep this file free of `@/` imports.

/** Where the request went. Only OpenRouter for now; direct-key routes can be added later. */
export type ProbeRoute = "openrouter";

/**
 * - accepted: the route took the parameter (and, where a cheap check exists, it had an effect).
 * - rejected: the route returned an error for it.
 * - ignored: the route took it, but a check showed no effect (e.g. `stop` didn't stop).
 * - inconclusive: rate limits, server errors, or timeouts kept the probe from answering.
 */
export type ProbeStatus = "accepted" | "rejected" | "ignored" | "inconclusive";

export type RouteProbe = {
	/** The id the route was called with (OpenRouter's model id). */
	modelId: string;
	/** Day of the run, YYYY-MM-DD. */
	probedAt: string;
	/** OpenRouter parameter names (`temperature`, `reasoning`, `structured_outputs`, …). */
	parameters: Readonly<Record<string, ProbeStatus>>;
	/** Short reason for anything not accepted: the route's error message or the failed check. */
	notes?: Readonly<Record<string, string>>;
};

/** Keyed by AI Gateway model id ("creator/model"), then route. */
export type ParameterProbeResults = Readonly<
	Record<string, Readonly<Partial<Record<ProbeRoute, RouteProbe>>>>
>;
