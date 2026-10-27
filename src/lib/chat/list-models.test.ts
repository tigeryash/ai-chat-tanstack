import { describe, expect, it } from "vitest";
import { listLocalModels, modelIdsFrom } from "./list-models";

function recordingFetch(response: Response) {
	const calls: { url: string; init?: RequestInit }[] = [];
	const fetchImpl = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return response;
	}) as typeof fetch;
	return { calls, fetchImpl };
}

describe("modelIdsFrom", () => {
	it("reads OpenAI-style, bare-array and Google lists", () => {
		expect(modelIdsFrom({ data: [{ id: "a" }, { id: 2 }, null] })).toEqual([
			"a",
		]);
		expect(modelIdsFrom([{ id: "b" }])).toEqual(["b"]);
		expect(
			modelIdsFrom({
				models: [
					{
						name: "models/gemini-x",
						supportedGenerationMethods: ["generateContent"],
					},
					{
						name: "models/embed",
						supportedGenerationMethods: ["embedContent"],
					},
				],
			}),
		).toEqual(["gemini-x"]);
		expect(modelIdsFrom("nope")).toEqual([]);
	});
});

describe("listLocalModels", () => {
	it("lists a local server's models without a key", async () => {
		const { calls, fetchImpl } = recordingFetch(
			Response.json({ data: [{ id: "qwen" }, { id: "gemma" }] }),
		);
		expect(await listLocalModels(fetchImpl)).toEqual({
			ok: true,
			models: ["gemma", "qwen"],
		});
		expect(calls[0].url).toBe("http://localhost:1234/v1/models");
		expect(calls[0].init?.headers).toBeUndefined();
		expect(calls[0].init?.credentials).toBe("omit");
	});

	it("reports a failure without reading the body", async () => {
		const { fetchImpl } = recordingFetch(new Response("", { status: 500 }));
		expect(await listLocalModels(fetchImpl)).toEqual({ ok: false });
	});
});
