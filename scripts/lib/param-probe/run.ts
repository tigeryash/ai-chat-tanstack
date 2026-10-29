import type {
	ProbeStatus,
	RouteProbe,
} from "../../../src/models/parameter-probe";
import { classify, type ProbeOutcome } from "./classify";
import {
	actualRequestUsd,
	estimateRequestUsd,
	fitsBudget,
	type UnitPricing,
} from "./cost";
import {
	type ChatCompletion,
	FALLBACK_MAX_TOKENS,
	MAX_TOKENS_PROBE,
	MIN_MAX_TOKENS,
	type Probe,
	type ProbeRequest,
} from "./probes";

// Probes one model on one route (roadmap 2.4a). The network sits behind `send`, so tests drive
// this with canned outcomes.

export type ProbeTarget = {
	gatewayId: string;
	/** The route's model id (OpenRouter's). */
	modelId: string;
	pricing: UnitPricing;
	probes: readonly Probe[];
};

export type Send = (
	request: ProbeRequest,
) => Promise<{ outcome: ProbeOutcome; attempts: number }>;

export type ModelRun = {
	/** Undefined when the baseline request failed, so nothing about this model can be trusted. */
	result?: RouteProbe;
	spentUsd: number;
	/** Why the model (or the whole run) stopped early. */
	stopped?: { reason: "budget" | "fatal" | "baseline"; message: string };
};

/**
 * What one sent request cost. OpenRouter doesn't bill errors, but a timeout may have been billed
 * without telling us, so those count at their worst case.
 */
function charge(
	pricing: UnitPricing,
	request: ProbeRequest,
	{ outcome, attempts }: Awaited<ReturnType<Send>>,
): number {
	if (outcome.kind === "network")
		return estimateRequestUsd(pricing, request) * attempts;
	const usage = (outcome.body as ChatCompletion | undefined)?.usage;
	if (outcome.status !== 200 && usage === undefined) return 0;
	return actualRequestUsd(pricing, usage, request);
}

export async function probeModel(
	target: ProbeTarget,
	{
		send,
		spentUsd,
		maxUsd,
		today,
	}: { send: Send; spentUsd: number; maxUsd: number; today: string },
): Promise<ModelRun> {
	let spent = 0;
	const parameters: Record<string, ProbeStatus> = {};
	const notes: Record<string, string> = {};

	const sendWithin = async (request: ProbeRequest) => {
		if (
			!fitsBudget(
				spentUsd + spent,
				estimateRequestUsd(target.pricing, request),
				maxUsd,
			)
		)
			return undefined;
		const sent = await send(request);
		spent += charge(target.pricing, request, sent);
		return sent.outcome;
	};
	// A stopped model keeps what it learned, but an empty entry would erase an older run's results.
	const partial = () =>
		Object.keys(parameters).length > 0 ? routeProbe() : undefined;
	const budgetStop = (): ModelRun => ({
		result: partial(),
		spentUsd: spent,
		stopped: { reason: "budget", message: `--max-usd ${maxUsd} reached` },
	});
	const routeProbe = (): RouteProbe => ({
		modelId: target.modelId,
		probedAt: today,
		parameters: { ...parameters },
		...(Object.keys(notes).length > 0 ? { notes: { ...notes } } : {}),
	});

	// Baseline: a plain request, which also finds the smallest max_tokens the model takes.
	let floor = MIN_MAX_TOKENS;
	let baseline: ProbeOutcome | undefined;
	for (const candidate of [MIN_MAX_TOKENS, FALLBACK_MAX_TOKENS]) {
		const request = MAX_TOKENS_PROBE.request({ floor: candidate });
		const outcome = await sendWithin(request);
		if (!outcome) return budgetStop();
		const { status, note, fatal } = classify(outcome);
		if (fatal)
			return { spentUsd: spent, stopped: { reason: "fatal", message: fatal } };
		floor = candidate;
		baseline = outcome;
		if (status === "accepted") break;
		if (status !== "rejected" || candidate === FALLBACK_MAX_TOKENS)
			return {
				spentUsd: spent,
				stopped: { reason: "baseline", message: note ?? status },
			};
	}

	for (const probe of target.probes) {
		const request = probe.request({ floor });
		const outcome =
			probe === MAX_TOKENS_PROBE ? baseline : await sendWithin(request);
		if (!outcome) return budgetStop();
		const { status, note, fatal } = classify(outcome, (completion) =>
			probe.check ? probe.check(completion, request) : "unknown",
		);
		if (fatal)
			return {
				result: partial(),
				spentUsd: spent,
				stopped: { reason: "fatal", message: fatal },
			};
		parameters[probe.parameter] = status;
		if (note) notes[probe.parameter] = note;
		else if (probe === MAX_TOKENS_PROBE && floor > MIN_MAX_TOKENS)
			notes[probe.parameter] = `Needs max_tokens >= ${floor}`;
	}
	return { result: routeProbe(), spentUsd: spent };
}
