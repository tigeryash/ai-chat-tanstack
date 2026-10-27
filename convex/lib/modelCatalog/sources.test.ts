import { describe, expect, it } from "vitest";
import { perMillionTokens, toPricing, tokenKey } from "./normalize";
import { parseArtificialAnalysisModels } from "./sources/artificialAnalysis";
import { gatewayEndpointsUrl, parseGatewayEndpoints, parseGatewayModels } from "./sources/gateway";
import { parseModelsDev } from "./sources/modelsDev";
import { parseOpenRouterModels } from "./sources/openRouter";
import { loadFixture } from "./test.helpers";

describe("normalize", () => {
  it("converts per-token prices to clean per-million numbers", () => {
    expect(perMillionTokens("0.00000012")).toBe(0.12);
    expect(perMillionTokens("0.000003")).toBe(3);
    expect(perMillionTokens("0")).toBe(0);
    expect(perMillionTokens("-1")).toBeUndefined();
    expect(perMillionTokens("free")).toBeUndefined();
    expect(perMillionTokens(null)).toBeUndefined();
  });

  it("keeps long-context tiers, including a first tier with no start", () => {
    expect(
      toPricing({
        input: "0.00001",
        output: "0.00005",
        inputTiers: [{ cost: "0.00001", max: 272001 }, { cost: "0.00002", min: 272001 }],
        outputTiers: [{ cost: "0.00005", max: 272001 }, { cost: "0.000075", min: 272001 }],
      }),
    ).toEqual({ input: 10, output: 50, tiers: [{ minPromptTokens: 272001, input: 20, output: 75 }] });
    expect(toPricing({})).toBeUndefined();
  });

  it("gives the same token key to names that differ only in word order or filler words", () => {
    expect(tokenKey("claude-sonnet-4.5")).toBe(tokenKey("claude-4-5-sonnet"));
    expect(tokenKey("qwen-3-14b")).toBe(tokenKey("qwen3-14b-instruct"));
    expect(tokenKey("claude-4-5-sonnet")).not.toBe(tokenKey("claude-4-5-sonnet-thinking"));
  });
});

describe("Gateway", () => {
  it("keeps language models only", () => {
    const { items, skipped } = parseGatewayModels(loadFixture("gateway-models"));
    expect(skipped).toBe(0);
    expect(items).toHaveLength(9);
    expect(items.some((model) => model.gatewayId === "openai/text-embedding-3-small")).toBe(false);
    expect(items.find((model) => model.gatewayId === "anthropic/claude-opus-5.5")).toMatchObject({
      developer: "anthropic",
      inputModalities: expect.arrayContaining(["text", "image"]),
      supportedParameters: expect.arrayContaining(["tools", "reasoning"]),
    });
  });

  it("skips a malformed entry without dropping the rest", () => {
    const body = loadFixture("gateway-models") as { data: unknown[] };
    const { items, skipped } = parseGatewayModels({
      data: [...body.data, { id: "no-creator", type: "language" }, "not an object"],
    });
    expect(items).toHaveLength(9);
    expect(skipped).toBe(2);
  });

  it("throws when the envelope is wrong, so the source counts as failed", () => {
    expect(() => parseGatewayModels({ models: [] })).toThrow();
  });

  it("parses providers per model, sorted by name", () => {
    const endpoints = loadFixture("gateway-endpoints") as Record<string, unknown>;
    const providers = parseGatewayEndpoints(endpoints["openai/gpt-oss-120b"]);
    expect(providers.map((provider) => provider.provider)).toEqual([...providers.map((p) => p.provider)].sort());
    expect(providers.find((provider) => provider.provider === "groq")).toMatchObject({
      zdr: expect.any(Boolean),
      pricing: { input: expect.any(Number), output: expect.any(Number) },
    });
  });

  it("builds endpoint URLs with each id segment encoded", () => {
    expect(gatewayEndpointsUrl("anthropic/claude-opus-5.5")).toBe(
      "https://ai-gateway.vercel.sh/v1/models/anthropic/claude-opus-5.5/endpoints",
    );
    expect(gatewayEndpointsUrl("a/b?c")).toBe("https://ai-gateway.vercel.sh/v1/models/a/b%3Fc/endpoints");
  });
});

describe("other sources", () => {
  it("reads Artificial Analysis ids, creator ids and indices", () => {
    const { items } = parseArtificialAnalysisModels(loadFixture("artificial-analysis"));
    expect(items.find((model) => model.slug === "claude-opus-5-5")).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      creatorId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      intelligenceIndex: 57.6,
    });
  });

  it("lists native ids per provider and names providers models.dev lacks", () => {
    const { ids, missingProviders } = parseModelsDev(loadFixture("models-dev"));
    expect(ids.anthropic).toContain("claude-opus-5-5");
    expect(ids.fireworks).toContain("accounts/fireworks/models/gpt-oss-120b");
    expect(missingProviders).toEqual([]);

    const { anthropic: _anthropic, ...withoutAnthropic } = loadFixture("models-dev") as Record<string, unknown>;
    const partial = parseModelsDev(withoutAnthropic);
    expect(partial.ids.anthropic).toEqual([]);
    expect(partial.missingProviders).toEqual(["anthropic"]);
    expect(() => parseModelsDev({ unrelated: {} })).toThrow(/none of our providers/);
  });

  it("drops OpenRouter's floating aliases", () => {
    const { items } = parseOpenRouterModels(loadFixture("openrouter"));
    expect(items.some((model) => model.id.startsWith("~"))).toBe(false);
    expect(items.find((model) => model.id === "x-ai/grok-4.7")?.supportedParameters.length).toBeGreaterThan(0);
  });
});
