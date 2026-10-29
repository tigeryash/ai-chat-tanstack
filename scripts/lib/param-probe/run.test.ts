import { describe, expect, it } from "vitest";
import type { ProbeOutcome } from "./classify";
import { chatBody, retryDelayMs, sendProbe } from "./openrouter";
import { PROBES, type ProbeRequest, probesFor } from "./probes";
import { mergeRouteProbe, renderResultsFile } from "./results-file";
import { probeModel, type Send } from "./run";

// probeModel and sendProbe driven by canned outcomes and a fake fetch. Nothing here calls a model.

const PRICING = { inputPerToken: 1e-6, outputPerToken: 2e-6, perRequest: 0 };
const OK_BODY = {
	choices: [{ finish_reason: "stop", message: { content: "red " } }],
	usage: { prompt_tokens: 8, completion_tokens: 2, cost: 0.0001 },
};
const OK: ProbeOutcome = { kind: "response", status: 200, body: OK_BODY };
const NO_ENDPOINTS: ProbeOutcome = {
	kind: "response",
	status: 404,
	body: {
		error: {
			code: 404,
			message: "No endpoints found that can handle the requested parameters.",
		},
	},
};

/** Answers OK unless the request uses one of `rejected`. Records what was sent. */
function fakeSend(rejected: readonly string[] = [], first?: ProbeOutcome) {
	const sent: ProbeRequest[] = [];
	const send: Send = async (request) => {
		sent.push(request);
		if (first && sent.length === 1) return { outcome: first, attempts: 1 };
		const uses = Object.keys(request.extra).some((key) =>
			rejected.includes(key),
		);
		return { outcome: uses ? NO_ENDPOINTS : OK, attempts: 1 };
	};
	return { send, sent };
}

const target = (parameters?: string[]) => ({
	gatewayId: "acme/model",
	modelId: "acme/model",
	pricing: PRICING,
	probes: probesFor({ gatewayId: "acme/model", listed: [] }, parameters),
});
const run = { spentUsd: 0, maxUsd: 1, today: "2026-10-29" };

describe("probeModel", () => {
	it("sends one baseline plus one request per other parameter", async () => {
		const { send, sent } = fakeSend(["temperature"]);
		const { result, spentUsd } = await probeModel(target(), { ...run, send });
		const probes = target().probes;
		expect(sent).toHaveLength(probes.length); // max_tokens reuses the baseline
		expect(result?.parameters.temperature).toBe("rejected");
		expect(result?.notes?.temperature).toContain("No endpoints");
		expect(result?.parameters.seed).toBe("accepted");
		expect(result?.probedAt).toBe("2026-10-29");
		// The rejected request has no usage: OpenRouter doesn't bill errors.
		expect(spentUsd).toBeCloseTo((probes.length - 1) * 0.0001, 10);
	});

	it("retries the baseline at 256 tokens when 16 is refused", async () => {
		const tooLow: ProbeOutcome = {
			kind: "response",
			status: 400,
			body: { error: { message: "max_tokens must be at least 64" } },
		};
		const { send, sent } = fakeSend([], tooLow);
		const { result } = await probeModel(target(["max_tokens", "seed"]), {
			...run,
			send,
		});
		expect(sent.map((r) => r.maxTokens)).toEqual([16, 256, 256]);
		expect(result?.notes?.max_tokens).toBe("Needs max_tokens >= 256");
	});

	it("records nothing when the baseline can't get through", async () => {
		const busy: ProbeOutcome = {
			kind: "response",
			status: 503,
			body: { error: { message: "Overloaded" } },
		};
		const { send } = fakeSend([], busy);
		const outcome = await probeModel(target(), { ...run, send });
		expect(outcome.result).toBeUndefined();
		expect(outcome.stopped?.reason).toBe("baseline");
	});

	it("stops before the request that would pass the cap", async () => {
		const { send, sent } = fakeSend();
		const outcome = await probeModel(target(), {
			...run,
			send,
			spentUsd: 0.99988,
			maxUsd: 1,
		});
		expect(outcome.stopped?.reason).toBe("budget");
		expect(sent.length).toBeLessThan(3);
	});

	it("stops the run when credit runs out", async () => {
		const broke: ProbeOutcome = {
			kind: "response",
			status: 402,
			body: { error: { message: "Insufficient credits" } },
		};
		const { send } = fakeSend([], broke);
		const outcome = await probeModel(target(), { ...run, send });
		expect(outcome.stopped?.reason).toBe("fatal");
	});
});

describe("sendProbe", () => {
	const request = PROBES[1].request({ floor: 16 });

	it("retries 429s with backoff, then returns the answer", async () => {
		const statuses = [429, 429, 200];
		const delays: number[] = [];
		const fetchFn = (async () => {
			const status = statuses.shift() ?? 200;
			return new Response(
				JSON.stringify(
					status === 200 ? OK_BODY : { error: { message: "slow down" } },
				),
				{
					status,
					headers: status === 429 ? { "retry-after": "2" } : {},
				},
			);
		}) as unknown as typeof fetch;
		const { outcome, attempts } = await sendProbe("acme/model", request, {
			apiKey: "test-key",
			fetchFn,
			sleep: async (ms) => {
				delays.push(ms);
			},
		});
		expect(outcome.kind === "response" && outcome.status).toBe(200);
		expect(attempts).toBe(3);
		expect(delays).toEqual([2000, 2000]);
	});

	it("sends require_parameters so unsupported parameters fail loudly", () => {
		expect(chatBody("acme/model", request)).toMatchObject({
			model: "acme/model",
			max_tokens: 16,
			temperature: 0.5,
			provider: { require_parameters: true },
		});
	});

	it("backs off exponentially without Retry-After, capped", () => {
		expect(retryDelayMs(1, null, () => 0)).toBe(1000);
		expect(retryDelayMs(3, null, () => 0)).toBe(4000);
		expect(retryDelayMs(10, null, () => 0)).toBe(30_000);
	});
});

describe("results file", () => {
	const probe = {
		modelId: "acme/model",
		probedAt: "2026-10-29",
		parameters: { top_k: "rejected", seed: "accepted" },
	} as const;

	it("replaces one model's route and keeps the rest", () => {
		const before = {
			"other/model": { openrouter: { ...probe, modelId: "other/model" } },
		};
		const after = mergeRouteProbe(before, "acme/model", "openrouter", probe);
		expect(Object.keys(after).sort()).toEqual(["acme/model", "other/model"]);
		expect(before).not.toHaveProperty("acme/model");
	});

	it("renders sorted, stable TypeScript", () => {
		const once = renderResultsFile(
			mergeRouteProbe({}, "acme/model", "openrouter", probe),
		);
		const again = renderResultsFile(
			mergeRouteProbe({}, "acme/model", "openrouter", {
				...probe,
				parameters: { seed: "accepted", top_k: "rejected" },
			}),
		);
		expect(once).toBe(again);
		expect(once).toContain('\t"acme/model": {\n\t\topenrouter: {');
		expect(once.indexOf("seed")).toBeLessThan(once.indexOf("top_k"));
		expect(once).toContain(
			"export const PARAMETER_PROBE: ParameterProbeResults = {",
		);
	});
});
