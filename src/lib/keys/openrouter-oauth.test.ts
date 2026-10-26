import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	finishOpenRouterConnect,
	OPENROUTER_EXCHANGE_URL,
	OpenRouterConnectError,
	readOpenRouterCallback,
	startOpenRouterConnect,
	withoutOpenRouterCallback,
} from "./openrouter-oauth";

function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		clear: () => items.clear(),
		getItem: (key) => items.get(key) ?? null,
		key: (index) => [...items.keys()][index] ?? null,
		removeItem: (key) => {
			items.delete(key);
		},
		setItem: (key, value) => {
			items.set(key, value);
		},
	};
}

const CALLBACK = "https://www.highelollms.com/settings";
const MINTED_KEY = "sk-or-v1-0123456789abcdef0123456789abcdef";

function exchangeFetch(response: Response) {
	const calls: { url: string; body: Record<string, string> }[] = [];
	const fetchImpl = (async (url: string, init?: RequestInit) => {
		calls.push({ url, body: JSON.parse(String(init?.body)) });
		return response;
	}) as typeof fetch;
	return { calls, fetchImpl };
}

async function start(storage: Storage, now = () => 1_000) {
	const authUrl = new URL(
		await startOpenRouterConnect(CALLBACK, "remember", { storage, now }),
	);
	return {
		authUrl,
		state: authUrl.searchParams.get("state") ?? "",
		challenge: authUrl.searchParams.get("code_challenge") ?? "",
	};
}

describe("OpenRouter PKCE", () => {
	it("builds the consent URL with an S256 challenge", async () => {
		const { authUrl } = await start(memoryStorage());
		expect(authUrl.origin + authUrl.pathname).toBe(
			"https://openrouter.ai/auth",
		);
		expect(authUrl.searchParams.get("callback_url")).toBe(CALLBACK);
		expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");
		expect(authUrl.searchParams.get("code_challenge")).toMatch(
			/^[A-Za-z0-9_-]{43}$/,
		);
		expect(authUrl.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{22}$/);
	});

	it("exchanges the code with the verifier that matches the challenge", async () => {
		const storage = memoryStorage();
		const { state, challenge } = await start(storage);
		const { calls, fetchImpl } = exchangeFetch(
			Response.json({ key: MINTED_KEY }),
		);

		const result = await finishOpenRouterConnect(
			{ code: "the-code", state },
			{ storage, now: () => 2_000, fetchImpl },
		);

		expect(result).toEqual({ key: MINTED_KEY, mode: "remember" });
		const [{ url, body }] = calls;
		expect(url).toBe(OPENROUTER_EXCHANGE_URL);
		expect(body.code).toBe("the-code");
		expect(body.code_challenge_method).toBe("S256");
		expect(
			createHash("sha256").update(body.code_verifier).digest("base64url"),
		).toBe(challenge);
	});

	it("uses a pending sign-in once", async () => {
		const storage = memoryStorage();
		const { state } = await start(storage);
		const { fetchImpl } = exchangeFetch(Response.json({ key: MINTED_KEY }));
		await finishOpenRouterConnect(
			{ code: "c", state },
			{ storage, fetchImpl, now: () => 2_000 },
		);

		await expect(
			finishOpenRouterConnect({ code: "c", state }, { storage, fetchImpl }),
		).rejects.toThrow(OpenRouterConnectError);
	});

	it("rejects a callback this tab didn't start, without calling OpenRouter", async () => {
		const storage = memoryStorage();
		await start(storage);
		const { calls, fetchImpl } = exchangeFetch(
			Response.json({ key: MINTED_KEY }),
		);

		await expect(
			finishOpenRouterConnect(
				{ code: "planted", state: "wrong" },
				{ storage, fetchImpl },
			),
		).rejects.toThrow(OpenRouterConnectError);
		await expect(
			finishOpenRouterConnect(
				{ code: "planted", state: null },
				{ storage: memoryStorage(), fetchImpl },
			),
		).rejects.toThrow(OpenRouterConnectError);
		expect(calls).toEqual([]);
	});

	it("rejects a sign-in older than OpenRouter's 10-minute code lifetime", async () => {
		const storage = memoryStorage();
		const { state } = await start(storage, () => 0);
		const { fetchImpl } = exchangeFetch(Response.json({ key: MINTED_KEY }));

		await expect(
			finishOpenRouterConnect(
				{ code: "c", state },
				{ storage, fetchImpl, now: () => 11 * 60_000 },
			),
		).rejects.toThrow(/too long/);
	});

	it("fails cleanly when OpenRouter refuses the exchange", async () => {
		const storage = memoryStorage();
		const { state } = await start(storage);
		const { fetchImpl } = exchangeFetch(
			new Response("forbidden", { status: 403 }),
		);

		await expect(
			finishOpenRouterConnect(
				{ code: "c", state },
				{ storage, fetchImpl, now: () => 2_000 },
			),
		).rejects.toThrow(/didn't issue a key/);
	});

	it("reads and strips the callback parameters", () => {
		const url = new URL(
			"https://www.highelollms.com/settings?code=abc&state=xyz&tab=keys#top",
		);
		expect(readOpenRouterCallback(url)).toEqual({ code: "abc", state: "xyz" });
		expect(withoutOpenRouterCallback(url)).toBe("/settings?tab=keys#top");
		expect(readOpenRouterCallback(new URL(CALLBACK))).toBeNull();
	});
});
