import { describe, expect, it, vi } from "vitest";
import { listModels, modelIdsFrom } from "./list-models";

const KEY = "sk-test-key-abcdefgh1234";

vi.mock("@/lib/keys", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/keys")>()),
	getProviderKey: vi.fn(async (provider: string) =>
		provider === "openai" ? KEY : null,
	),
}));

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

describe("listModels", () => {
	it("reuses the key test's request for a provider whose list needs the key", async () => {
		const { calls, fetchImpl } = recordingFetch(
			Response.json({ data: [{ id: "gpt-b" }, { id: "gpt-a" }] }),
		);
		expect(await listModels("openai", fetchImpl)).toEqual({
			ok: true,
			models: ["gpt-a", "gpt-b"],
		});
		expect(calls[0].url).toBe("https://api.openai.com/v1/models");
		expect(JSON.stringify(calls[0].init?.headers)).toContain(KEY);
		expect(calls[0].init?.credentials).toBe("omit");
	});

	it("reads OpenRouter's public list without a key", async () => {
		const { calls, fetchImpl } = recordingFetch(Response.json({ data: [] }));
		await listModels("openrouter", fetchImpl);
		expect(calls[0].url).toBe("https://openrouter.ai/api/v1/models");
		expect(calls[0].init?.headers).toBeUndefined();
	});

	it("needs a key for other providers, and reports failures", async () => {
		const { calls, fetchImpl } = recordingFetch(
			new Response("", { status: 401 }),
		);
		expect(await listModels("mistral", fetchImpl)).toEqual({
			ok: false,
			reason: "no-key",
		});
		expect(calls).toEqual([]);
		expect(await listModels("openai", fetchImpl)).toEqual({
			ok: false,
			reason: "failed",
		});
	});

	it("lists a local server's models", async () => {
		const { calls, fetchImpl } = recordingFetch(
			Response.json({ data: [{ id: "qwen" }] }),
		);
		expect(await listModels("local", fetchImpl)).toEqual({
			ok: true,
			models: ["qwen"],
		});
		expect(calls[0].url).toBe("http://localhost:1234/v1/models");
	});
});
