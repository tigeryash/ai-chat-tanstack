// Parameter probe (roadmap 2.4a, decision 15): checks which generation settings each model really
// accepts, because catalog `supported_parameters` lists drift from what hosts do. Results go to
// src/models/parameter-probe.generated.ts (re-exported by curation.ts) for the settings panel (2.4b).
//
//   bun scripts/probe-params.ts                     # dry run: plan and cost estimate, spends nothing
//   bun scripts/probe-params.ts --yes               # real run, capped at --max-usd (default $0.50)
//   bun scripts/probe-params.ts --yes --model openai/gpt-oss-120b --parameter stop --parameter seed
//
// Options:
//   --yes                Actually send requests. Without it nothing is sent to a model.
//   --max-usd <n>        Stop before any request whose worst case would push spend past n (default 0.5).
//   --model <id>         Add a model (Gateway id or OpenRouter id). Repeatable.
//   --skip-high-elo      Probe only the --model ones, not the High Elo set.
//   --parameter <name>   Probe only these OpenRouter parameter names. Repeatable.
//   --catalog <file>     Read the catalog from a JSON export of `models.list` instead of Convex.
//
// Models: the High Elo set from the public `models.list` query (VITE_CONVEX_URL), plus --model.
// Each goes through OpenRouter with `provider.require_parameters: true`, so a parameter no host
// supports comes back as an error instead of being dropped silently. Per model: one baseline
// request (which is also the max_tokens probe and finds the smallest max_tokens the model takes),
// then one request per parameter, with a one-word prompt and 16–64 output tokens. Each result is
// accepted, rejected, ignored (a cheap check showed no effect: stop, max_tokens, JSON modes,
// tool_choice), or inconclusive (rate limits or server errors after 4 tries with backoff).
//
// Cost: the estimate assumes every request uses its full max_tokens, at the dearer of catalog and
// OpenRouter prices. Spend is tracked from OpenRouter's `usage.cost`. Models with no price are skipped.
//
// Needs OPENROUTER_API_KEY for --yes. Bun loads .env.local from the working directory, so run it from
// the main checkout, or pass `bun --env-file=<path>/.env.local`. It's the developer's own key: never
// give it a VITE_ prefix. The script sends it only to openrouter.ai and never prints it.
//
// Re-runnable: each run replaces the probed models' entries and keeps the others, sorted, so the
// same results produce the same file. A model stopped by the budget keeps the parameters it finished.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { ParameterProbeResults } from "../src/models/parameter-probe";
import { PARAMETER_PROBE } from "../src/models/parameter-probe.generated";
import {
	normalizeCatalog,
	type ProbeCatalogModel,
} from "./lib/param-probe/catalog";
import {
	dearerPricing,
	estimatePlan,
	formatUsd,
	pricingFromCatalog,
	pricingFromOpenRouter,
	type UnitPricing,
} from "./lib/param-probe/cost";
import {
	fetchOpenRouterListings,
	type OpenRouterListing,
	sendProbe,
} from "./lib/param-probe/openrouter";
import {
	MAX_TOKENS_PROBE,
	MIN_MAX_TOKENS,
	PROBES,
	type Probe,
	probesFor,
} from "./lib/param-probe/probes";
import {
	mergeRouteProbe,
	renderResultsFile,
} from "./lib/param-probe/results-file";
import { probeModel } from "./lib/param-probe/run";

const RESULTS_FILE = fileURLToPath(
	new URL("../src/models/parameter-probe.generated.ts", import.meta.url),
);
const DEFAULT_MAX_USD = 0.5;

type Target = {
	gatewayId: string;
	openRouterId: string;
	pricing: UnitPricing | undefined;
	listed: readonly string[];
	probes: Probe[];
};

function readOptions() {
	const { values } = parseArgs({
		options: {
			yes: { type: "boolean", default: false },
			"max-usd": { type: "string", default: String(DEFAULT_MAX_USD) },
			model: { type: "string", multiple: true, default: [] },
			"skip-high-elo": { type: "boolean", default: false },
			parameter: { type: "string", multiple: true },
			catalog: { type: "string" },
		},
	});
	const maxUsd = Number(values["max-usd"]);
	if (!Number.isFinite(maxUsd) || maxUsd <= 0)
		throw new Error(
			`--max-usd must be a positive number, got ${values["max-usd"]}`,
		);
	const known = new Set(PROBES.map((probe) => probe.parameter));
	for (const name of values.parameter ?? [])
		if (!known.has(name))
			throw new Error(
				`Unknown --parameter ${name}. Known: ${[...known].join(", ")}`,
			);
	return {
		yes: values.yes,
		maxUsd,
		models: values.model,
		skipHighElo: values["skip-high-elo"],
		parameters: values.parameter,
		catalog: values.catalog,
	};
}

async function loadCatalog(
	file: string | undefined,
): Promise<ProbeCatalogModel[]> {
	if (file) return normalizeCatalog(JSON.parse(readFileSync(file, "utf8")));
	const url = process.env.VITE_CONVEX_URL;
	if (!url)
		throw new Error(
			"VITE_CONVEX_URL is not set. Run from the main checkout (it has .env.local) or pass --catalog.",
		);
	const body: unknown = await new ConvexHttpClient(url).query(
		api.models.list,
		{},
	);
	return normalizeCatalog(body);
}

function buildTargets(
	catalog: readonly ProbeCatalogModel[],
	listings: ReadonlyMap<string, OpenRouterListing>,
	options: ReturnType<typeof readOptions>,
): { targets: Target[]; skipped: string[] } {
	const chosen = new Map<
		string,
		{ gatewayId: string; openRouterId?: string; model?: ProbeCatalogModel }
	>();
	if (!options.skipHighElo)
		for (const model of catalog.filter((m) => m.highElo))
			chosen.set(model.gatewayId, {
				gatewayId: model.gatewayId,
				openRouterId: model.openRouterId,
				model,
			});
	for (const id of options.models) {
		const model = catalog.find(
			(m) => m.gatewayId === id || m.openRouterId === id,
		);
		const gatewayId = model?.gatewayId ?? id;
		chosen.set(gatewayId, {
			gatewayId,
			openRouterId: model?.openRouterId ?? id,
			model,
		});
	}

	const targets: Target[] = [];
	const skipped: string[] = [];
	for (const { gatewayId, openRouterId, model } of chosen.values()) {
		const listing = openRouterId ? listings.get(openRouterId) : undefined;
		if (!openRouterId || !listing) {
			skipped.push(`${gatewayId}: not on OpenRouter`);
			continue;
		}
		const listed = listing.supportedParameters;
		targets.push({
			gatewayId,
			openRouterId,
			pricing: dearerPricing(
				pricingFromCatalog(model?.pricing),
				pricingFromOpenRouter(listing.pricing),
			),
			listed,
			probes: probesFor({ gatewayId, listed }, options.parameters),
		});
	}
	targets.sort((a, b) => a.gatewayId.localeCompare(b.gatewayId));
	return { targets, skipped };
}

/** The requests a model will get: the baseline (also the max_tokens probe) plus one per other probe. */
function plannedRequests(target: Target) {
	const context = { floor: MIN_MAX_TOKENS };
	return [
		MAX_TOKENS_PROBE.request(context),
		...target.probes
			.filter((probe) => probe !== MAX_TOKENS_PROBE)
			.map((probe) => probe.request(context)),
	];
}

function printPlan(
	targets: readonly Target[],
	skipped: readonly string[],
	maxUsd: number,
) {
	const estimate = estimatePlan(
		targets.map((target) => ({
			gatewayId: target.gatewayId,
			pricing: target.pricing,
			requests: plannedRequests(target),
		})),
	);
	const all = [
		...new Set(
			targets.flatMap((target) =>
				target.probes.map((probe) => probe.parameter),
			),
		),
	];
	console.log("Parameter probe plan (OpenRouter route)\n");
	console.log(`Parameters: ${all.join(", ")}\n`);
	for (const model of estimate.models) {
		const target = targets.find((t) => t.gatewayId === model.gatewayId);
		const missing = all.filter(
			(name) => !target?.probes.some((probe) => probe.parameter === name),
		);
		const skips = missing.length > 0 ? `  (skips ${missing.join(", ")})` : "";
		console.log(
			`  ${model.gatewayId.padEnd(36)} ${String(model.requests).padStart(3)} requests  ≤ ${formatUsd(model.usd)}${skips}`,
		);
	}
	for (const line of skipped) console.log(`  skip ${line}`);
	for (const id of estimate.unpriced)
		console.log(`  skip ${id}: no price in the catalog or on OpenRouter`);
	console.log(
		`\n${estimate.models.length} models, ${estimate.requests} requests, worst case ${formatUsd(estimate.totalUsd)} (cap --max-usd ${maxUsd}).`,
	);
	console.log(
		"Models that refuse max_tokens 16 get one retry at 256, which can add a little.",
	);
	if (estimate.totalUsd > maxUsd)
		console.log(
			`The estimate is over the cap: the run stops before the request that would pass ${formatUsd(maxUsd)}.`,
		);
	return estimate;
}

function describeDrift(
	target: Target,
	statuses: Readonly<Record<string, string>>,
): string[] {
	const lines: string[] = [];
	for (const [parameter, status] of Object.entries(statuses)) {
		const isListed = target.listed.includes(parameter);
		if (isListed && status !== "accepted" && status !== "inconclusive")
			lines.push(`listed but ${status}: ${parameter}`);
		if (!isListed && status === "accepted")
			lines.push(`accepted but not listed: ${parameter}`);
	}
	return lines;
}

async function run(targets: readonly Target[], maxUsd: number) {
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey)
		throw new Error(
			"OPENROUTER_API_KEY is not set (it lives in the main checkout's .env.local).",
		);
	const today = new Date().toISOString().slice(0, 10);
	let results: ParameterProbeResults = PARAMETER_PROBE;
	let spentUsd = 0;

	for (const target of targets) {
		if (!target.pricing) continue;
		console.log(`\n${target.gatewayId} (${target.openRouterId})`);
		const outcome = await probeModel(
			{
				gatewayId: target.gatewayId,
				modelId: target.openRouterId,
				pricing: target.pricing,
				probes: target.probes,
			},
			{
				send: (request) => sendProbe(target.openRouterId, request, { apiKey }),
				spentUsd,
				maxUsd,
				today,
			},
		);
		spentUsd += outcome.spentUsd;
		if (outcome.result) {
			results = mergeRouteProbe(
				results,
				target.gatewayId,
				"openrouter",
				outcome.result,
			);
			writeFileSync(RESULTS_FILE, renderResultsFile(results));
			for (const [parameter, status] of Object.entries(
				outcome.result.parameters,
			)) {
				const note = outcome.result.notes?.[parameter];
				console.log(
					`  ${parameter.padEnd(20)} ${status}${note ? `  (${note})` : ""}`,
				);
			}
			for (const line of describeDrift(target, outcome.result.parameters))
				console.log(`  ! ${line}`);
		}
		console.log(
			`  spent ${formatUsd(outcome.spentUsd)}, total ${formatUsd(spentUsd)}`,
		);
		if (outcome.stopped) {
			console.log(`  stopped: ${outcome.stopped.message}`);
			if (outcome.stopped.reason !== "baseline") break;
		}
	}
	console.log(
		`\nDone. Spent about ${formatUsd(spentUsd)}. Results: src/models/parameter-probe.generated.ts`,
	);
}

async function main() {
	const options = readOptions();
	const [catalog, listings] = await Promise.all([
		loadCatalog(options.catalog),
		fetchOpenRouterListings(),
	]);
	const { targets, skipped } = buildTargets(catalog, listings, options);
	const estimate = printPlan(targets, skipped, options.maxUsd);
	if (!options.yes) {
		console.log("\nDry run: nothing was sent to a model. Add --yes to spend.");
		return;
	}
	if (estimate.models.length === 0) return;
	if (!existsSync(RESULTS_FILE)) throw new Error(`Missing ${RESULTS_FILE}`);
	await run(targets, options.maxUsd);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
