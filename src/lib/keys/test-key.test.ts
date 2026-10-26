import { describe, expect, it } from "vitest";
import { PROVIDER_API_ORIGINS } from "@/lib/security/provider-origins";
import { PROVIDER_IDS } from "./providers";
import { TEST_REQUESTS, testProviderKey } from "./test-key";

const KEY = "test-key-abcdefgh1234";

function recordingFetch(response: Response | Error) {
	const calls: { url: string; init?: RequestInit }[] = [];
	const fetchImpl = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		if (response instanceof Error) throw response;
		return response;
	}) as typeof fetch;
	return { calls, fetchImpl };
}

describe("testProviderKey", () => {
	it.each(PROVIDER_IDS)(
		"sends %s's key only to an allowlisted origin, in a header",
		async (providerId) => {
			const { calls, fetchImpl } = recordingFetch(Response.json({ data: [] }));
			await testProviderKey(providerId, KEY, fetchImpl);

			const [{ url, init }] = calls;
			expect(PROVIDER_API_ORIGINS).toContain(new URL(url).origin);
			expect(url).not.toContain(KEY);
			expect(Object.values(init?.headers ?? {}).join(" ")).toContain(KEY);
			expect(init?.credentials).toBe("omit");
		},
	);

	it("counts models in a list response", async () => {
		const { fetchImpl } = recordingFetch(
			Response.json({ data: [{ id: "a" }, { id: "b" }] }),
		);
		expect(await testProviderKey("openai", KEY, fetchImpl)).toEqual({
			ok: true,
			modelCount: 2,
		});
	});

	it("reads Google's and Together's list shapes", async () => {
		expect(TEST_REQUESTS.google.countModels?.({ models: [1, 2, 3] })).toBe(3);
		expect(TEST_REQUESTS.together.countModels?.([1])).toBe(1);
	});

	it.each([
		[401, "rejected"],
		[400, "rejected"],
		[403, "rejected"],
		[429, "rate-limited"],
		[503, "provider-error"],
	])(
		"maps status %i to %s without reading the body",
		async (status, reason) => {
			const { fetchImpl } = recordingFetch(
				new Response(`Incorrect API key provided: ${KEY}`, { status }),
			);
			const result = await testProviderKey("openai", KEY, fetchImpl);
			expect(result).toEqual({ ok: false, reason });
			expect(JSON.stringify(result)).not.toContain(KEY);
		},
	);

	it("reports a network or CORS failure as unreachable", async () => {
		const { fetchImpl } = recordingFetch(new TypeError("Failed to fetch"));
		expect(await testProviderKey("openai", KEY, fetchImpl)).toEqual({
			ok: false,
			reason: "unreachable",
		});
	});
});
