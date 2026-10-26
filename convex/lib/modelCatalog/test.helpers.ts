// Recorded source responses for the model catalog tests (re-record with
// scripts/record-model-catalog-fixtures.ts). The two dots keep Convex from deploying this file.
import { readFileSync } from "node:fs";
import { ARTIFICIAL_ANALYSIS_MODELS_URL } from "./sources/artificialAnalysis";
import { GATEWAY_MODELS_URL } from "./sources/gateway";
import { MODELS_DEV_URL } from "./sources/modelsDev";
import { OPENROUTER_MODELS_URL } from "./sources/openRouter";

export type FixtureName = "gateway-models" | "gateway-endpoints" | "artificial-analysis" | "models-dev" | "openrouter";

export function loadFixture(name: FixtureName): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
}

type Json = { data: Record<string, unknown>[] };

/** The Gateway fixture without some models, as if the Gateway had stopped listing them. */
export function gatewayWithout(...gatewayIds: string[]): unknown {
  const body = loadFixture("gateway-models") as Json;
  return { ...body, data: body.data.filter((model) => !gatewayIds.includes(model.id as string)) };
}

export type FakeSource = "gateway" | "gatewayEndpoints" | "artificialAnalysis" | "modelsDev" | "openRouter";

export type FakeNetworkOptions = {
  /** Sources that answer 503. */
  down?: FakeSource[];
  /** Replaces a source's whole response body. */
  bodies?: Partial<Record<FakeSource, unknown>>;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/**
 * A `fetch` that serves the fixtures and fails loudly on any other URL, so a test can never reach the
 * real services. Records every URL it was asked for, and the headers of Artificial Analysis calls.
 */
export function fakeNetwork(options: FakeNetworkOptions = {}) {
  const requests: { url: string; headers: Headers }[] = [];
  const down = new Set(options.down ?? []);
  const endpoints = loadFixture("gateway-endpoints") as Record<string, unknown>;

  function respond(source: FakeSource, body: () => unknown): Response {
    if (down.has(source)) return json({ error: "unavailable" }, 503);
    return json(options.bodies?.[source] ?? body());
  }

  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    requests.push({ url, headers: new Headers(init?.headers) });
    if (url === GATEWAY_MODELS_URL) return respond("gateway", () => loadFixture("gateway-models"));
    if (url.startsWith(`${GATEWAY_MODELS_URL}/`) && url.endsWith("/endpoints")) {
      const gatewayId = decodeURIComponent(url.slice(GATEWAY_MODELS_URL.length + 1, -"/endpoints".length));
      if (!(gatewayId in endpoints) && !down.has("gatewayEndpoints")) return json({ error: "not found" }, 404);
      return respond("gatewayEndpoints", () => endpoints[gatewayId]);
    }
    if (url === ARTIFICIAL_ANALYSIS_MODELS_URL) return respond("artificialAnalysis", () => loadFixture("artificial-analysis"));
    if (url === MODELS_DEV_URL) return respond("modelsDev", () => loadFixture("models-dev"));
    if (url === OPENROUTER_MODELS_URL) return respond("openRouter", () => loadFixture("openrouter"));
    throw new Error(`Test tried to reach the network: ${url}`);
  };

  return { fetch, requests };
}
