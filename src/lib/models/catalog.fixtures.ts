import type { CatalogModel, ModelCatalog } from "./catalog";

// A small seeded catalog for unit tests and the e2e Convex stub (e2e/support/convex-stub.ts), which
// serves it as `models.list` and `models.get`. Made-up but shaped like the real sync's output.

const at = (date: string) => Date.parse(`${date}T00:00:00Z`);

function model(
	fields: Partial<CatalogModel> &
		Pick<CatalogModel, "gatewayId" | "name" | "developer">,
): CatalogModel {
	return {
		description: "",
		inputModalities: ["text"],
		outputModalities: ["text"],
		tags: [],
		zdr: "none",
		noTraining: "none",
		nativeIds: [],
		pinned: false,
		highElo: false,
		status: "active",
		firstSeenAt: at("2026-10-01"),
		...fields,
	};
}

export const TEST_MODELS: readonly CatalogModel[] = [
	model({
		gatewayId: "anthropic/claude-opus-5.5",
		name: "Claude Opus 5.5",
		developer: "anthropic",
		description: "Anthropic's most capable model for complex work.",
		contextWindow: 1_000_000,
		maxOutputTokens: 128_000,
		pricing: { input: 5, output: 25 },
		releasedAt: at("2026-08-12"),
		knowledgeCutoff: "2026-03",
		inputModalities: ["text", "image", "file"],
		tags: ["reasoning", "tool-use", "vision", "file-input"],
		zdr: "all",
		noTraining: "all",
		providers: ["anthropic", "bedrock", "vertex"],
		intelligenceIndex: 74,
		nativeIds: [{ provider: "anthropic", modelId: "claude-opus-5-5" }],
		openRouterId: "anthropic/claude-opus-5.5",
		highElo: true,
	}),
	model({
		gatewayId: "openai/gpt-5.5",
		name: "GPT-5.5",
		developer: "openai",
		description: "OpenAI's flagship reasoning model.",
		contextWindow: 400_000,
		pricing: { input: 1.25, output: 10 },
		releasedAt: at("2026-09-02"),
		knowledgeCutoff: "2026-01-31",
		inputModalities: ["text", "image"],
		tags: ["reasoning", "tool-use", "vision", "web-search"],
		zdr: "some",
		noTraining: "all",
		providers: ["openai", "azure"],
		intelligenceIndex: 72,
		nativeIds: [{ provider: "openai", modelId: "gpt-5.5" }],
		openRouterId: "openai/gpt-5.5",
		highElo: true,
	}),
	model({
		gatewayId: "spacexai/grok-4.7",
		name: "Grok 4.7",
		developer: "spacexai",
		contextWindow: 256_000,
		pricing: { input: 3, output: 15 },
		releasedAt: at("2026-07-20"),
		tags: ["reasoning", "tool-use"],
		intelligenceIndex: 68,
		// Not on OpenRouter: only an xAI key (or AI Gateway) runs it.
		nativeIds: [{ provider: "xai", modelId: "grok-4.7" }],
		highElo: true,
	}),
	model({
		gatewayId: "google/gemini-3.8-flash",
		name: "Gemini 3.8 Flash",
		developer: "google",
		contextWindow: 1_048_576,
		pricing: { input: 0.3, output: 2.5 },
		releasedAt: at("2026-06-10"),
		inputModalities: ["text", "image", "file"],
		tags: ["reasoning", "tool-use", "vision", "file-input"],
		intelligenceIndex: 58,
		nativeIds: [{ provider: "google", modelId: "gemini-3.8-flash" }],
		openRouterId: "google/gemini-3.8-flash",
		pinned: true,
		highElo: true,
	}),
	model({
		gatewayId: "anthropic/claude-sonnet-5",
		name: "Claude Sonnet 5",
		developer: "anthropic",
		contextWindow: 200_000,
		pricing: { input: 3, output: 15 },
		releasedAt: at("2026-05-01"),
		tags: ["reasoning", "tool-use"],
		intelligenceIndex: 61,
		nativeIds: [{ provider: "anthropic", modelId: "claude-sonnet-5" }],
		openRouterId: "anthropic/claude-sonnet-5",
	}),
	model({
		gatewayId: "moonshotai/kimi-k3",
		name: "Kimi K3",
		developer: "moonshotai",
		contextWindow: 256_000,
		pricing: { input: 0.6, output: 2.5 },
		releasedAt: at("2026-09-28"),
		tags: ["tool-use", "open-weights"],
		intelligenceIndex: 55,
		nativeIds: [{ provider: "moonshot", modelId: "kimi-k3" }],
		openRouterId: "moonshotai/kimi-k3",
	}),
	model({
		gatewayId: "deepseek/deepseek-v4.1-flash",
		name: "DeepSeek V4.1 Flash",
		developer: "deepseek",
		contextWindow: 128_000,
		pricing: { input: 0.1, output: 0.4 },
		releasedAt: at("2026-04-15"),
		tags: ["open-weights"],
		nativeIds: [
			{ provider: "deepseek", modelId: "deepseek-chat" },
			{
				provider: "fireworks",
				modelId: "accounts/fireworks/models/deepseek-v4p1-flash",
			},
		],
		openRouterId: "deepseek/deepseek-v4.1-flash",
	}),
];

/** Gone from the Gateway; `models.get` still answers for it, so old chats show the banner. */
export const TEST_REMOVED_MODEL: CatalogModel = model({
	gatewayId: "anthropic/claude-sonnet-4.5",
	name: "Claude Sonnet 4.5",
	developer: "anthropic",
	releasedAt: at("2025-09-29"),
	nativeIds: [{ provider: "anthropic", modelId: "claude-sonnet-4-5" }],
	openRouterId: "anthropic/claude-sonnet-4.5",
	status: "removed",
	removedAt: at("2026-10-20"),
});

export const TEST_CATALOG: ModelCatalog = {
	models: [...TEST_MODELS],
	sources: [{ source: "gateway", lastSyncedAt: at("2026-10-27") }],
};

/** What `models.get` answers for an id. */
export function testCatalogModel(gatewayId: string): CatalogModel | null {
	return (
		[...TEST_MODELS, TEST_REMOVED_MODEL].find(
			(entry) => entry.gatewayId === gatewayId,
		) ?? null
	);
}
