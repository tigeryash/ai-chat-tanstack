import { describe, expect, it, vi } from "vitest";
import { listLocalModels, MAX_LOCAL_MODELS, modelIdsFrom } from "./list-models";

const BASE = "http://localhost:1234/v1";

function recordingFetch(response: Response | Error) {
	const calls: { url: string; init?: RequestInit }[] = [];
	const fetchImpl = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		if (response instanceof Error) throw response;
		return response;
	}) as typeof fetch;
	return { calls, fetchImpl };
}

describe("modelIdsFrom", () => {
	it("reads OpenAI-style and bare-array lists", () => {
		expect(modelIdsFrom({ data: [{ id: "a" }, { id: 2 }, null] })).toEqual([
			"a",
		]);
		expect(modelIdsFrom([{ id: "b" }])).toEqual(["b"]);
		expect(modelIdsFrom("nope")).toBeNull();
	});

	it("drops ids a model choice can't hold", () => {
		const longest = "m".repeat(200);
		expect(
			modelIdsFrom({
				data: [
					{ id: longest },
					{ id: `${longest}x` },
					{ id: "  " },
					{ id: "ok" },
				],
			}),
		).toEqual([longest, "ok"]);
	});
});

/** A fetch that never answers on its own, but rejects like a browser when its signal aborts. */
const hangingFetch = ((_url: string, init?: RequestInit) =>
	new Promise((_, reject) => {
		init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
	})) as typeof fetch;

describe("listLocalModels", () => {
	it("lists a local server's models without a key or cookies", async () => {
		const { calls, fetchImpl } = recordingFetch(
			Response.json(
				{ data: [{ id: "qwen" }, { id: "gemma" }, { id: "qwen" }] },
				{ headers: { "access-control-allow-origin": "*" } },
			),
		);
		expect(await listLocalModels(BASE, { fetch: fetchImpl })).toEqual({
			ok: true,
			models: ["gemma", "qwen"],
			allowOrigin: "*",
		});
		expect(calls[0].url).toBe(`${BASE}/models`);
		expect(calls[0].init?.headers).toBeUndefined();
		expect(calls[0].init?.credentials).toBe("omit");
	});

	it("reports an HTTP error with its status", async () => {
		const { fetchImpl } = recordingFetch(new Response("", { status: 404 }));
		expect(await listLocalModels(BASE, { fetch: fetchImpl })).toEqual({
			ok: false,
			reason: "bad-response",
			status: 404,
		});
	});

	it("reports a body that isn't a model list", async () => {
		const { fetchImpl } = recordingFetch(Response.json({ hello: "world" }));
		expect(await listLocalModels(BASE, { fetch: fetchImpl })).toEqual({
			ok: false,
			reason: "bad-response",
		});
	});

	it("gives up on a server that never answers", async () => {
		const networkAccess = vi.fn();
		expect(
			await listLocalModels(BASE, {
				fetch: hangingFetch,
				networkAccess,
				timeoutMs: 10,
			}),
		).toEqual({ ok: false, reason: "timed-out" });
		expect(networkAccess).not.toHaveBeenCalled();
	});

	it("gives up on a body that never finishes", async () => {
		const stalledBody = (async (_url: string, init?: RequestInit) =>
			new Response(
				new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode('{"data": ['));
						init?.signal?.addEventListener("abort", () =>
							controller.error(init.signal?.reason),
						);
					},
				}),
			)) as typeof fetch;
		expect(
			await listLocalModels(BASE, { fetch: stalledBody, timeoutMs: 10 }),
		).toEqual({ ok: false, reason: "timed-out" });
	});

	it("passes a timeout signal by default", async () => {
		const { calls, fetchImpl } = recordingFetch(Response.json({ data: [] }));
		await listLocalModels(BASE, { fetch: fetchImpl });
		expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal);
	});

	it("keeps the first ids a huge list reports", async () => {
		const ids = Array.from(
			{ length: MAX_LOCAL_MODELS + 500 },
			(_, index) => `model-${String(index).padStart(5, "0")}`,
		);
		const { fetchImpl } = recordingFetch(
			Response.json({ data: ids.map((id) => ({ id })) }),
		);
		const list = await listLocalModels(BASE, { fetch: fetchImpl });
		expect(list.ok && list.models).toEqual(ids.slice(0, MAX_LOCAL_MODELS));
	});

	it("tells a blocked Local Network Access permission from a stopped server", async () => {
		const { fetchImpl } = recordingFetch(new TypeError("Failed to fetch"));
		expect(
			await listLocalModels(BASE, {
				fetch: fetchImpl,
				networkAccess: async () => "denied",
			}),
		).toEqual({ ok: false, reason: "denied" });
		expect(
			await listLocalModels(BASE, {
				fetch: fetchImpl,
				networkAccess: async () => "granted",
			}),
		).toEqual({ ok: false, reason: "unreachable" });
	});
});
