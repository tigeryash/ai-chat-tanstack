import { z } from "@/lib/zod";
import type { KeyMode } from "./vault";

// "Connect OpenRouter" (roadmap decision 1): OAuth PKCE, which mints a key the user owns and can cap
// on OpenRouter's consent page. https://openrouter.ai/docs/guides/overview/auth/oauth
// 1. `start` makes a verifier and a state, keeps them in sessionStorage (this tab only), and returns
//    the consent URL carrying the verifier's SHA-256 challenge.
// 2. OpenRouter sends the browser back to the callback URL with `?code=…&state=…`.
// 3. `finish` checks the state, then trades code + verifier for the key, browser → OpenRouter.
// A code alone is useless: without this tab's verifier the exchange fails, so a planted callback
// link can't connect someone else's account.

export const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
export const OPENROUTER_EXCHANGE_URL = "https://openrouter.ai/api/v1/auth/keys";
const PENDING_KEY = "highelo:openrouter-pkce";
/** OpenRouter's codes expire after 10 minutes. */
const MAX_PENDING_MS = 10 * 60 * 1000;
const KEY_LABEL = "High Elo LLMs";

const pendingSchema = z.object({
	verifier: z.string().min(43),
	state: z.string().min(16),
	mode: z.enum(["session", "remember"]),
	createdAt: z.number(),
});

const exchangeSchema = z.object({ key: z.string().min(8) });

export class OpenRouterConnectError extends Error {
	override name = "OpenRouterConnectError";
}

interface Options {
	storage?: Storage;
	now?: () => number;
}

export async function startOpenRouterConnect(
	callbackUrl: string,
	mode: KeyMode,
	{ storage = sessionStorage, now = Date.now }: Options = {},
): Promise<string> {
	const verifier = randomBase64Url(32);
	const state = randomBase64Url(16);
	storage.setItem(
		PENDING_KEY,
		JSON.stringify({ verifier, state, mode, createdAt: now() }),
	);
	const url = new URL(OPENROUTER_AUTH_URL);
	url.searchParams.set("callback_url", callbackUrl);
	url.searchParams.set("code_challenge", await sha256Base64Url(verifier));
	url.searchParams.set("code_challenge_method", "S256");
	url.searchParams.set("state", state);
	url.searchParams.set("key_label", KEY_LABEL);
	return url.toString();
}

export interface OpenRouterCallback {
	code: string;
	state: string | null;
}

/** The `code` and `state` OpenRouter added to the callback URL, or null if this isn't a callback. */
export function readOpenRouterCallback(url: URL): OpenRouterCallback | null {
	const code = url.searchParams.get("code");
	return code ? { code, state: url.searchParams.get("state") } : null;
}

/** `url` without the callback's parameters, for `history.replaceState`. */
export function withoutOpenRouterCallback(url: URL): string {
	const clean = new URL(url);
	clean.searchParams.delete("code");
	clean.searchParams.delete("state");
	return `${clean.pathname}${clean.search}${clean.hash}`;
}

/**
 * Trades the callback's code for a key. The pending verifier is removed first, so a callback is used
 * at most once (React may run the effect twice; a reload must not retry).
 */
export async function finishOpenRouterConnect(
	callback: OpenRouterCallback,
	{
		storage = sessionStorage,
		now = Date.now,
		fetchImpl = fetch,
	}: Options & { fetchImpl?: typeof fetch } = {},
): Promise<{ key: string; mode: KeyMode }> {
	const raw = storage.getItem(PENDING_KEY);
	storage.removeItem(PENDING_KEY);
	const pending = pendingSchema.safeParse(parseJson(raw));
	if (!pending.success) {
		throw new OpenRouterConnectError(
			"This page wasn't expecting an OpenRouter sign-in. Start again from Connect OpenRouter.",
		);
	}
	const { verifier, state, mode, createdAt } = pending.data;
	if (callback.state !== state) {
		throw new OpenRouterConnectError(
			"The OpenRouter sign-in didn't match this tab. Start again from Connect OpenRouter.",
		);
	}
	if (now() - createdAt > MAX_PENDING_MS) {
		throw new OpenRouterConnectError(
			"The OpenRouter sign-in took too long. Start again from Connect OpenRouter.",
		);
	}

	let response: Response;
	try {
		response = await fetchImpl(OPENROUTER_EXCHANGE_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				code: callback.code,
				code_verifier: verifier,
				code_challenge_method: "S256",
			}),
			credentials: "omit",
			referrerPolicy: "origin",
			cache: "no-store",
		});
	} catch {
		throw new OpenRouterConnectError(
			"Couldn't reach OpenRouter. Check your connection and try again.",
		);
	}
	const body = exchangeSchema.safeParse(
		response.ok ? await response.json().catch(() => null) : null,
	);
	if (!body.success) {
		throw new OpenRouterConnectError(
			"OpenRouter didn't issue a key. Start again from Connect OpenRouter.",
		);
	}
	return { key: body.data.key, mode };
}

function parseJson(text: string | null): unknown {
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function randomBase64Url(byteLength: number): string {
	return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256Base64Url(text: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(text),
	);
	return toBase64Url(new Uint8Array(digest));
}

function toBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
}
