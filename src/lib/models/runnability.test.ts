import { describe, expect, it } from "vitest";
import type { ProviderId } from "@/lib/keys/providers";
import { providerToConnect, routesFor } from "./runnability";

const opus = {
	gatewayId: "anthropic/claude-opus-5.5",
	developer: "anthropic",
	nativeIds: [
		{ provider: "anthropic", modelId: "claude-opus-5-5" },
		{ provider: "not-a-provider", modelId: "x" },
	],
	openRouterId: "anthropic/claude-opus-5.5",
};

const connected = (...ids: ProviderId[]) => new Set(ids);

describe("routesFor", () => {
	it("is empty when no connected provider serves the model", () => {
		expect(routesFor(opus, connected("openai"))).toEqual([]);
	});

	it("puts OpenRouter first, then direct keys, then AI Gateway", () => {
		expect(
			routesFor(opus, connected("vercel", "anthropic", "openrouter")),
		).toEqual([
			{ provider: "openrouter", model: "anthropic/claude-opus-5.5" },
			{ provider: "anthropic", model: "claude-opus-5-5" },
			{ provider: "vercel", model: "anthropic/claude-opus-5.5" },
		]);
	});

	it("uses native ids when OpenRouter isn't connected", () => {
		expect(routesFor(opus, connected("anthropic"))).toEqual([
			{ provider: "anthropic", model: "claude-opus-5-5" },
		]);
	});

	it("skips OpenRouter for a model it doesn't list", () => {
		const model = { ...opus, openRouterId: undefined };
		expect(routesFor(model, connected("openrouter"))).toEqual([]);
	});
});

describe("providerToConnect", () => {
	it("prefers the developer's own API", () => {
		const model = {
			...opus,
			nativeIds: [
				{ provider: "groq", modelId: "x" },
				{ provider: "anthropic", modelId: "y" },
			],
		};
		expect(providerToConnect(model)).toBe("anthropic");
	});

	it("maps Gateway developer ids to key providers", () => {
		const grok = {
			gatewayId: "spacexai/grok-4.7",
			developer: "spacexai",
			nativeIds: [
				{ provider: "together", modelId: "a" },
				{ provider: "xai", modelId: "grok-4.7" },
			],
		};
		expect(providerToConnect(grok)).toBe("xai");
	});

	it("falls back to OpenRouter, then AI Gateway", () => {
		expect(providerToConnect({ ...opus, nativeIds: [] })).toBe("openrouter");
		expect(
			providerToConnect({ ...opus, nativeIds: [], openRouterId: undefined }),
		).toBe("vercel");
	});
});
