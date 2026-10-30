import { describe, expect, it } from "vitest";
import { MODEL_CURATION } from "../../../src/models/curation";
import { diffCatalog, formatDiff } from "./diff";
import { indexArtificialAnalysis, matchArtificialAnalysis } from "./match";
import {
	applyEndpoints,
	buildCatalog,
	type CatalogSources,
	type Curation,
	selectEndpointTargets,
} from "./merge";
import {
	type AaModel,
	parseArtificialAnalysisModels,
} from "./sources/artificialAnalysis";
import { parseGatewayModels } from "./sources/gateway";
import { parseModelsDev } from "./sources/modelsDev";
import { parseOpenRouterModels } from "./sources/openRouter";
import { loadFixture } from "./test.helpers";
import type { ModelRow } from "./validators";

const NOW = Date.UTC(2026, 9, 26);
const curation: Curation = { models: {}, hiddenPatterns: [/-batch$/] };

function allSources(): CatalogSources {
	return {
		gateway: {
			ok: true,
			data: parseGatewayModels(loadFixture("gateway-models")).items,
		},
		artificialAnalysis: {
			ok: true,
			data: parseArtificialAnalysisModels(loadFixture("artificial-analysis"))
				.items,
		},
		modelsDev: {
			ok: true,
			data: parseModelsDev(loadFixture("models-dev")).ids,
		},
		openRouter: {
			ok: true,
			data: parseOpenRouterModels(loadFixture("openrouter")).items,
		},
	};
}

function row(rows: readonly ModelRow[], gatewayId: string): ModelRow {
	const found = rows.find((candidate) => candidate.gatewayId === gatewayId);
	if (!found) throw new Error(`no row ${gatewayId}`);
	return found;
}

const down = { ok: false as const, error: "HTTP 503" };

describe("buildCatalog matching", () => {
	const rows = buildCatalog([], allSources(), curation, NOW);

	it("matches scores exactly, by reordered words, and through serving variants", () => {
		expect(
			row(rows, "anthropic/claude-opus-5.5").artificialAnalysis?.slug,
		).toBe("claude-opus-5-5");
		expect(
			row(rows, "anthropic/claude-sonnet-4.5").artificialAnalysis?.slug,
		).toBe("claude-4-5-sonnet");
		expect(
			row(rows, "anthropic/claude-opus-5.5-batch").artificialAnalysis?.slug,
		).toBe("claude-opus-5-5");
	});

	it("matches OpenRouter by id, or by model name under another creator name", () => {
		expect(row(rows, "openai/gpt-6.1-sol").openRouter?.id).toBe(
			"openai/gpt-6.1-sol",
		);
		expect(row(rows, "spacexai/grok-4.7").openRouter?.id).toBe("x-ai/grok-4.7");
	});

	it("finds native ids on first-party APIs and on open-weight hosts", () => {
		expect(row(rows, "anthropic/claude-opus-5.5").nativeIds).toEqual([
			{ provider: "anthropic", modelId: "claude-opus-5-5" },
		]);
		expect(row(rows, "openai/gpt-oss-120b").nativeIds).toEqual([
			{ provider: "groq", modelId: "openai/gpt-oss-120b" },
			{ provider: "together", modelId: "openai/gpt-oss-120b" },
			{
				provider: "fireworks",
				modelId: "accounts/fireworks/models/gpt-oss-120b",
			},
			{ provider: "cerebras", modelId: "gpt-oss-120b" },
			{ provider: "huggingface", modelId: "openai/gpt-oss-120b" },
		]);
	});

	it("applies curation over the matches", () => {
		const curated = buildCatalog(
			[],
			allSources(),
			{
				hiddenPatterns: [],
				models: {
					"spacexai/grok-4.7": {
						pinned: true,
						displayName: "Grok 4.7 (curated)",
						artificialAnalysisSlug: null,
						openRouterId: null,
						nativeIds: { xai: null, groq: "grok-on-groq" },
						parameters: { add: ["seed"], remove: ["stop"] },
					},
				},
			},
			NOW,
		);
		const grok = row(curated, "spacexai/grok-4.7");
		expect(grok).toMatchObject({
			pinned: true,
			hidden: false,
			name: "Grok 4.7 (curated)",
		});
		expect(grok.artificialAnalysis).toBeUndefined();
		expect(grok.openRouter).toBeUndefined();
		expect(grok.nativeIds).toEqual([
			{ provider: "groq", modelId: "grok-on-groq" },
		]);
		expect(grok.supportedParameters).toContain("seed");
		expect(grok.supportedParameters).not.toContain("stop");
		expect(row(curated, "anthropic/claude-opus-5.5-batch").hidden).toBe(false);
	});

	it("prefers the Artificial Analysis id matched before over a slug that now points elsewhere", () => {
		const models: AaModel[] = [
			{ id: "old-id", slug: "renamed-slug", creatorId: "c" },
			{ id: "other-id", slug: "grok-4-7", creatorId: "c" },
		];
		const index = indexArtificialAnalysis(models);
		expect(
			matchArtificialAnalysis("spacexai/grok-4.7", index, {
				previousModelId: "old-id",
			})?.id,
		).toBe("old-id");
		expect(matchArtificialAnalysis("spacexai/grok-4.7", index, {})?.id).toBe(
			"other-id",
		);
	});

	it("refuses an ambiguous reordered match", () => {
		const index = indexArtificialAnalysis([
			{ id: "a", slug: "model-4-5-x", creatorId: "c" },
			{ id: "b", slug: "x-4-5-model", creatorId: "c" },
		]);
		expect(
			matchArtificialAnalysis("dev/model-x-4.5", index, {}),
		).toBeUndefined();
	});
});

describe("buildCatalog when sources fail", () => {
	const previous = buildCatalog([], allSources(), curation, NOW);
	const later = NOW + 86_400_000;

	it("keeps every row as it was when the Gateway is down", () => {
		expect(
			buildCatalog(
				previous,
				{ ...allSources(), gateway: down },
				curation,
				later,
			),
		).toEqual(previous);
	});

	it("keeps each enrichment's previous values when its source is down", () => {
		const sources = {
			...allSources(),
			artificialAnalysis: down,
			modelsDev: down,
			openRouter: down,
		};
		const next = buildCatalog(previous, sources, curation, later);
		expect(next).toEqual(previous);
	});

	it("clears a score only when Artificial Analysis answered without that model", () => {
		const next = buildCatalog(
			previous,
			{ ...allSources(), artificialAnalysis: { ok: true, data: [] } },
			curation,
			later,
		);
		expect(
			row(next, "anthropic/claude-opus-5.5").artificialAnalysis,
		).toBeUndefined();
	});

	it("marks models missing from a loaded Gateway list as removed, keeping their data", () => {
		const gateway = allSources().gateway;
		if (!gateway.ok) throw new Error("fixture failed");
		const withoutGrok = gateway.data.filter(
			(model) => model.gatewayId !== "spacexai/grok-4.7",
		);
		const next = buildCatalog(
			previous,
			{ ...allSources(), gateway: { ok: true, data: withoutGrok } },
			curation,
			later,
		);
		const grok = row(next, "spacexai/grok-4.7");
		expect(grok).toEqual({
			...row(previous, "spacexai/grok-4.7"),
			status: "removed",
			removedAt: later,
		});
		// A removed model stays frozen on later runs, with its first removal time.
		const again = buildCatalog(
			next,
			{ ...allSources(), gateway: { ok: true, data: withoutGrok } },
			curation,
			later + 1,
		);
		expect(row(again, "spacexai/grok-4.7")).toEqual(grok);
	});
});

describe("endpoints", () => {
	const rows = buildCatalog(
		[],
		allSources(),
		{ ...curation, models: MODEL_CURATION },
		NOW,
	);

	it("targets pins first, then the best-scored models, skipping hidden ones and serving variants", () => {
		const targets = selectEndpointTargets(rows, 3);
		expect(targets.slice(0, 2).sort()).toEqual([
			"anthropic/claude-haiku-5.5",
			"openai/gpt-oss-120b",
		]);
		// Scores in the fixture: Opus 5.5 57.6, Kimi K3.1 Pro 55.1, Gemini 4 Argon 52.6, GPT-6.1 Sol 51.8.
		expect(targets.slice(2)).toEqual([
			"anthropic/claude-opus-5.5",
			"moonshotai/kimi-k3.1-pro",
			"google/gemini-4-argon",
		]);
		expect(targets).not.toContain("anthropic/claude-opus-5.5-batch");
	});

	it("keeps a model's old providers when its call failed", () => {
		const withProviders = applyEndpoints(
			rows,
			new Map([
				[
					"openai/gpt-6.1-sol",
					{
						ok: true as const,
						data: [{ provider: "openai", zdr: true, noTraining: true }],
					},
				],
			]),
			NOW,
		);
		const afterFailure = applyEndpoints(
			withProviders,
			new Map([["openai/gpt-6.1-sol", down]]),
			NOW + 1,
		);
		expect(row(afterFailure, "openai/gpt-6.1-sol")).toMatchObject({
			providers: [{ provider: "openai" }],
			providersSyncedAt: NOW,
		});
	});
});

describe("diffCatalog", () => {
	const previous = buildCatalog([], allSources(), curation, NOW);

	it("lists new, removed, restored and changed models, ignoring uptime", () => {
		const changed = previous
			.filter((model) => model.gatewayId !== "anthropic/claude-haiku-5.5")
			.map((model): ModelRow => {
				if (model.gatewayId === "spacexai/grok-4.7")
					return { ...model, status: "removed", removedAt: NOW };
				if (model.gatewayId === "openai/gpt-6.1-sol")
					return { ...model, contextWindow: 1 };
				if (model.gatewayId === "google/gemini-4-argon") {
					return {
						...model,
						providers: [
							{ provider: "google", zdr: true, noTraining: true, uptime1d: 99 },
						],
					};
				}
				return model;
			});
		const withUptime = changed.map((model) =>
			model.gatewayId === "google/gemini-4-argon"
				? {
						...model,
						providers: [
							{ provider: "google", zdr: true, noTraining: true, uptime1d: 97 },
						],
					}
				: model,
		);

		const diff = diffCatalog(previous, changed);
		expect(diff.added).toEqual([]);
		expect(diff.removed).toEqual(["spacexai/grok-4.7"]);
		expect(diff.changed).toEqual([
			{ gatewayId: "google/gemini-4-argon", fields: ["providers"] },
			{ gatewayId: "openai/gpt-6.1-sol", fields: ["contextWindow"] },
		]);

		const uptimeOnly = diffCatalog(changed, withUptime);
		expect(uptimeOnly.changed).toEqual([]);
		expect(uptimeOnly.writes.map((model) => model.gatewayId)).toEqual([
			"google/gemini-4-argon",
		]);

		const restored = diffCatalog(changed, previous);
		expect(restored.added).toEqual(["anthropic/claude-haiku-5.5"]);
		expect(restored.restored).toEqual(["spacexai/grok-4.7"]);
		expect(formatDiff(restored)[0]).toBe("new 1: anthropic/claude-haiku-5.5");
	});
});
