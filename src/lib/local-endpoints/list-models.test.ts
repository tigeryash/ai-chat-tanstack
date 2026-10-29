import { describe, expect, it } from "vitest";
import { listLocalModels, modelIdsFrom } from "./list-models";

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
});

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
