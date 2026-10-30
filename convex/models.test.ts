import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { ARTIFICIAL_ANALYSIS_KEY_ENV } from "./lib/modelCatalog/sources/artificialAnalysis";
import {
	type FakeNetworkOptions,
	fakeNetwork,
	gatewayWithout,
} from "./lib/modelCatalog/test.helpers";
import { createConvexTest } from "./test.helpers";

// Roadmap 2.1 "Done when": a run populates the table, and a run with one source down leaves it intact.
// Every source is served from recorded fixtures; any other request fails the test.

const FAKE_AA_KEY = "aa-test-key-not-real";

async function sync(
	t: ReturnType<typeof createConvexTest>,
	options: FakeNetworkOptions = {},
) {
	const network = fakeNetwork(options);
	vi.stubGlobal("fetch", network.fetch);
	const summary = await t.action(internal.modelCatalogSync.sync, {});
	return { summary, network };
}

async function tableRows(t: ReturnType<typeof createConvexTest>) {
	const rows = await t.run((ctx) => ctx.db.query("models").collect());
	return rows
		.map(({ _id, _creationTime, ...row }) => row)
		.sort((a, b) => a.gatewayId.localeCompare(b.gatewayId));
}

/** Rows minus the endpoint sync time, which moves on every run that reaches the endpoints source. */
async function catalogData(t: ReturnType<typeof createConvexTest>) {
	return (await tableRows(t)).map(
		({ providersSyncedAt: _syncedAt, ...row }) => row,
	);
}

async function sourceRows(t: ReturnType<typeof createConvexTest>) {
	const rows = await t.run((ctx) =>
		ctx.db.query("modelCatalogSources").collect(),
	);
	return Object.fromEntries(rows.map((row) => [row.source, row]));
}

describe("model catalog sync", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-10-26T06:17:00Z"));
		vi.stubEnv(ARTIFICIAL_ANALYSIS_KEY_ENV, FAKE_AA_KEY);
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it("populates the table from every source", async () => {
		const t = createConvexTest();
		const { summary, network } = await sync(t);

		const rows = await tableRows(t);
		// Nine language models in the fixture; the embedding model is left out.
		expect(rows.map((row) => row.gatewayId)).toEqual([
			"anthropic/claude-haiku-5.5",
			"anthropic/claude-opus-5.5",
			"anthropic/claude-opus-5.5-batch",
			"anthropic/claude-sonnet-4.5",
			"google/gemini-4-argon",
			"moonshotai/kimi-k3.1-pro",
			"openai/gpt-6.1-sol",
			"openai/gpt-oss-120b",
			"spacexai/grok-4.7",
		]);
		expect(summary).toMatchObject({
			models: 9,
			written: 9,
			added: 9,
			removed: 0,
		});

		const opus = rows.find(
			(row) => row.gatewayId === "anthropic/claude-opus-5.5",
		);
		expect(opus).toMatchObject({
			name: "Claude Opus 5.5",
			developer: "anthropic",
			status: "active",
			hidden: false,
			artificialAnalysis: { slug: "claude-opus-5-5", intelligenceIndex: 57.6 },
			openRouter: { id: "anthropic/claude-opus-5.5" },
			nativeIds: [{ provider: "anthropic", modelId: "claude-opus-5-5" }],
		});
		expect(opus?.providers?.map((provider) => provider.provider)).toEqual([
			"anthropic",
			"bedrock",
			"claudeaws",
			"vertexAnthropic",
		]);

		// Curation: pinned, and the batch variant is hidden but still stored.
		expect(
			rows.find((row) => row.gatewayId === "anthropic/claude-haiku-5.5")
				?.pinned,
		).toBe(true);
		expect(
			rows.find((row) => row.gatewayId === "anthropic/claude-opus-5.5-batch")
				?.hidden,
		).toBe(true);

		// Hidden models get no endpoints call; the key goes only to Artificial Analysis.
		expect(
			network.requests.some(({ url }) => url.includes("claude-opus-5.5-batch")),
		).toBe(false);
		const withKey = network.requests.filter(
			({ headers }) => headers.get("x-api-key") === FAKE_AA_KEY,
		);
		expect(withKey.map(({ url }) => new URL(url).host)).toEqual([
			"artificialanalysis.ai",
		]);

		const sources = await sourceRows(t);
		expect(Object.keys(sources).sort()).toEqual([
			"artificialAnalysis",
			"gateway",
			"gatewayEndpoints",
			"modelsDev",
			"openRouter",
		]);
		for (const source of Object.values(sources)) {
			expect(source.lastSyncedAt).toBe(Date.now());
			expect(source.lastError).toBeUndefined();
		}
	});

	it("serves visible models through the public query, and any model by id", async () => {
		const t = createConvexTest();
		await sync(t);

		const { models, sources } = await t.query(api.models.list, {});
		expect(models).toHaveLength(8);
		expect(models.some((model) => model.gatewayId.endsWith("-batch"))).toBe(
			false,
		);
		expect(sources).toHaveLength(5);
		expect(sources[0]).not.toHaveProperty("lastError");

		// Slimmed for the picker: no supported-parameter lists or per-provider pricing.
		expect(models[0]).not.toHaveProperty("supportedParameters");
		const highElo = models
			.filter((model) => model.highElo)
			.map((model) => model.gatewayId);
		expect(highElo).toEqual(
			models
				.filter(
					(model) => model.pinned || model.intelligenceIndex !== undefined,
				)
				.map((model) => model.gatewayId),
		);
		expect(highElo).toContain("anthropic/claude-haiku-5.5");

		const batch = await t.query(api.models.get, {
			gatewayId: "anthropic/claude-opus-5.5-batch",
		});
		expect(batch?.gatewayId).toBe("anthropic/claude-opus-5.5-batch");
		expect(
			await t.query(api.models.get, { gatewayId: "nobody/nothing" }),
		).toBeNull();
	});

	it.each([
		"gateway",
		"gatewayEndpoints",
		"artificialAnalysis",
		"modelsDev",
		"openRouter",
	] as const)("leaves every row intact when %s is down", async (source) => {
		const t = createConvexTest();
		await sync(t);
		const before = await catalogData(t);
		const firstRun = Date.now();

		vi.setSystemTime(new Date("2026-10-27T06:17:00Z"));
		const { summary } = await sync(t, { down: [source] });

		expect(await catalogData(t)).toEqual(before);
		expect(summary).toMatchObject({
			added: 0,
			removed: 0,
			restored: 0,
			changed: 0,
		});

		const sources = await sourceRows(t);
		expect(sources[source].lastSyncedAt).toBe(firstRun);
		expect(sources[source].lastAttemptAt).toBe(Date.now());
		expect(sources[source].lastError).toMatch(/HTTP 503/);
		for (const other of Object.values(sources).filter(
			(row) => row.source !== source,
		)) {
			expect(other.lastSyncedAt).toBe(Date.now());
		}
	});

	it("keeps scores and skips Artificial Analysis when its key is missing", async () => {
		const t = createConvexTest();
		await sync(t);
		const before = await tableRows(t);

		vi.stubEnv(ARTIFICIAL_ANALYSIS_KEY_ENV, "");
		const { network } = await sync(t);

		expect(
			network.requests.some(({ url }) => url.includes("artificialanalysis.ai")),
		).toBe(false);
		expect(await tableRows(t)).toEqual(before);
		expect((await sourceRows(t)).artificialAnalysis.lastError).toMatch(
			/ARTIFICIAL_ANALYSIS_API_KEY is not set/,
		);
	});

	it("treats an empty Gateway list as a failure, not as every model removed", async () => {
		const t = createConvexTest();
		await sync(t);
		const before = await tableRows(t);

		await sync(t, { bodies: { gateway: { object: "list", data: [] } } });

		expect(await tableRows(t)).toEqual(before);
		expect((await sourceRows(t)).gateway.lastError).toMatch(
			/no language models/,
		);
	});

	it("treats a malformed Gateway answer as a failure", async () => {
		const t = createConvexTest();
		await sync(t);
		const before = await tableRows(t);

		await sync(t, {
			bodies: { gateway: { models: "not the expected shape" } },
		});

		expect(await tableRows(t)).toEqual(before);
		expect((await sourceRows(t)).gateway.lastError).toBeDefined();
	});

	it("marks a model the Gateway drops as removed, keeps its data, and restores it when it returns", async () => {
		const t = createConvexTest();
		await sync(t);
		const before = (await tableRows(t)).find(
			(row) => row.gatewayId === "spacexai/grok-4.7",
		);

		vi.setSystemTime(new Date("2026-10-27T06:17:00Z"));
		const { summary } = await sync(t, {
			bodies: { gateway: gatewayWithout("spacexai/grok-4.7") },
		});
		expect(summary).toMatchObject({ removed: 1, models: 9 });

		const removed = await t.query(api.models.get, {
			gatewayId: "spacexai/grok-4.7",
		});
		expect(removed).toMatchObject({
			status: "removed",
			removedAt: Date.now(),
			name: before?.name,
		});
		expect(removed?.intelligenceIndex).toBe(
			before?.artificialAnalysis?.intelligenceIndex,
		);
		const { models } = await t.query(api.models.list, {});
		expect(
			models.some((model) => model.gatewayId === "spacexai/grok-4.7"),
		).toBe(false);

		vi.setSystemTime(new Date("2026-10-28T06:17:00Z"));
		const restored = await sync(t);
		expect(restored.summary.restored).toBe(1);
		const back = await t.query(api.models.get, {
			gatewayId: "spacexai/grok-4.7",
		});
		expect(back?.status).toBe("active");
		expect(back?.removedAt).toBeUndefined();
		expect(back?.firstSeenAt).toBe(before?.firstSeenAt);
	});

	it("writes nothing when nothing changed", async () => {
		const t = createConvexTest();
		await sync(t);
		const { summary } = await sync(t);
		expect(summary).toMatchObject({
			written: 0,
			added: 0,
			removed: 0,
			restored: 0,
			changed: 0,
		});
	});
});
