import { type Infer, v } from "convex/values";

// Shape of a `models` row (roadmap 2.1). Shared by the schema and the sync mutation's arguments.

/** How many of a model's Gateway providers offer zero data retention / no training on prompts. */
const coverageValidator = v.union(v.literal("all"), v.literal("some"), v.literal("none"));

/** USD per million tokens. */
export const pricingValidator = v.object({
  input: v.optional(v.number()),
  output: v.optional(v.number()),
  cacheRead: v.optional(v.number()),
  cacheWrite: v.optional(v.number()),
  /** Higher prices from a prompt length up (long-context tiers). */
  tiers: v.optional(
    v.array(
      v.object({
        minPromptTokens: v.number(),
        input: v.optional(v.number()),
        output: v.optional(v.number()),
      }),
    ),
  ),
  /** The Gateway's list price is a floor; some of its providers charge more. */
  variesByProvider: v.optional(v.boolean()),
});

export const reasoningOptionValidator = v.object({
  type: v.string(),
  values: v.optional(v.array(v.string())),
  min: v.optional(v.number()),
  max: v.optional(v.number()),
});

/** One provider behind a Gateway model, from `/v1/models/{id}/endpoints`. */
export const gatewayProviderValidator = v.object({
  provider: v.string(),
  pricing: v.optional(pricingValidator),
  contextWindow: v.optional(v.number()),
  maxOutputTokens: v.optional(v.number()),
  /** Percent of requests that succeeded over the last day. */
  uptime1d: v.optional(v.number()),
  zdr: v.boolean(),
  noTraining: v.boolean(),
  quantization: v.optional(v.string()),
});

/** Artificial Analysis scores. Showing them requires crediting artificialanalysis.ai. */
export const artificialAnalysisValidator = v.object({
  modelId: v.string(),
  slug: v.string(),
  creatorId: v.string(),
  intelligenceIndex: v.optional(v.number()),
  codingIndex: v.optional(v.number()),
  mathIndex: v.optional(v.number()),
  outputTokensPerSecond: v.optional(v.number()),
  timeToFirstTokenSeconds: v.optional(v.number()),
});

export const nativeIdValidator = v.object({
  provider: v.string(),
  modelId: v.string(),
});

export const openRouterValidator = v.object({
  id: v.string(),
  supportedParameters: v.array(v.string()),
});

export const modelStatusValidator = v.union(v.literal("active"), v.literal("removed"));

export const modelFields = {
  /** AI Gateway id, "creator/model". The row's identity. */
  gatewayId: v.string(),
  name: v.string(),
  /** Gateway `owned_by`, e.g. "anthropic". */
  developer: v.string(),
  description: v.string(),
  contextWindow: v.optional(v.number()),
  maxOutputTokens: v.optional(v.number()),
  pricing: v.optional(pricingValidator),
  releasedAt: v.optional(v.number()),
  /** As the Gateway gives it: "2025-04" or "2025-07-31". */
  knowledgeCutoff: v.optional(v.string()),
  inputModalities: v.array(v.string()),
  outputModalities: v.array(v.string()),
  tags: v.array(v.string()),
  supportedParameters: v.array(v.string()),
  reasoningOptions: v.array(reasoningOptionValidator),
  zdr: coverageValidator,
  noTraining: coverageValidator,
  deprecatedAt: v.optional(v.number()),

  providers: v.optional(v.array(gatewayProviderValidator)),
  providersSyncedAt: v.optional(v.number()),
  artificialAnalysis: v.optional(artificialAnalysisValidator),
  nativeIds: v.array(nativeIdValidator),
  openRouter: v.optional(openRouterValidator),

  pinned: v.boolean(),
  hidden: v.boolean(),
  /** `removed` once the Gateway stops listing it. Rows are never deleted, so old chats keep working. */
  status: modelStatusValidator,
  firstSeenAt: v.number(),
  removedAt: v.optional(v.number()),
};

export const modelRowValidator = v.object(modelFields);
export type ModelRow = Infer<typeof modelRowValidator>;
export type Pricing = Infer<typeof pricingValidator>;
export type GatewayProvider = Infer<typeof gatewayProviderValidator>;
export type ArtificialAnalysisScores = Infer<typeof artificialAnalysisValidator>;
export type NativeId = Infer<typeof nativeIdValidator>;

export const CATALOG_SOURCES = [
  "gateway",
  "gatewayEndpoints",
  "artificialAnalysis",
  "modelsDev",
  "openRouter",
] as const;
export type CatalogSource = (typeof CATALOG_SOURCES)[number];

export const catalogSourceValidator = v.union(
  v.literal("gateway"),
  v.literal("gatewayEndpoints"),
  v.literal("artificialAnalysis"),
  v.literal("modelsDev"),
  v.literal("openRouter"),
);

/** The outcome of one source in one sync run. */
export const sourceRunValidator = v.object({
  source: catalogSourceValidator,
  ok: v.boolean(),
  itemCount: v.optional(v.number()),
  /** Why the source failed. Its fields in `models` keep their previous values. */
  error: v.optional(v.string()),
  /** The source answered, but not completely (some entries invalid, some calls failed). */
  warning: v.optional(v.string()),
});
export type SourceRun = Infer<typeof sourceRunValidator>;
