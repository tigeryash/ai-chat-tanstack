import { createHash } from "node:crypto";
import type { Page, Request } from "@playwright/test";
import { PROVIDER_API_ORIGINS } from "../src/lib/security/provider-origins";
import { expect, test } from "./support/fixtures";

// Roadmap 1.1: API key settings (/e2e/keys renders them without a session). Every provider origin
// is faked here, so nothing leaves the machine. Each test records every request the page makes
// (our server, the Convex stub, providers) plus Convex WebSocket frames, and checks that the key
// only ever went to its own provider's origin.

const OPENAI_KEY = "sk-proj-e2eFakeOpenAiKey0123456789abcd";
const MISTRAL_KEY = "E2eFakeMistralKey0123456789wxyz";
const MINTED_OPENROUTER_KEY = "sk-or-v1-e2eFakeMintedKey0123456789beef";

interface Sent {
	origin: string;
	text: string;
}

const CORS_HEADERS = {
	"access-control-allow-origin": "*",
	"access-control-allow-headers": "*",
	"access-control-allow-methods": "GET, POST, OPTIONS",
};

/** Fakes every provider API and records everything the page sends anywhere. */
async function interceptTraffic(page: Page) {
	const sent: Promise<Sent>[] = [];
	const exchanges: Record<string, string>[] = [];

	page.on("request", (request: Request) => {
		sent.push(
			request.allHeaders().then((headers) => ({
				origin: new URL(request.url()).origin,
				text: [
					request.url(),
					JSON.stringify(headers),
					request.postData() ?? "",
				].join("\n"),
			})),
		);
	});
	page.on("websocket", (socket) => {
		const origin = new URL(socket.url()).origin;
		socket.on("framesent", ({ payload }) => {
			sent.push(Promise.resolve({ origin, text: String(payload) }));
		});
	});

	for (const origin of PROVIDER_API_ORIGINS) {
		await page.route(`${origin}/**`, async (route) => {
			const request = route.request();
			const url = new URL(request.url());
			if (request.method() === "OPTIONS") {
				return route.fulfill({ status: 204, headers: CORS_HEADERS });
			}
			if (url.href.startsWith("https://openrouter.ai/auth?")) {
				// OpenRouter's consent page: the user approves, and it sends them back with a code.
				const callback = new URL(url.searchParams.get("callback_url") ?? "");
				callback.searchParams.set("code", "e2e-auth-code");
				callback.searchParams.set("state", url.searchParams.get("state") ?? "");
				exchanges.push({
					challenge: url.searchParams.get("code_challenge") ?? "",
				});
				return route.fulfill({
					status: 302,
					headers: { location: callback.href },
				});
			}
			if (url.href === "https://openrouter.ai/api/v1/auth/keys") {
				exchanges.push(request.postDataJSON());
				return route.fulfill({
					headers: CORS_HEADERS,
					json: { key: MINTED_OPENROUTER_KEY, user_id: "user_e2e" },
				});
			}
			return route.fulfill({
				headers: CORS_HEADERS,
				json: { data: [{ id: "model-a" }, { id: "model-b" }] },
			});
		});
	}

	return {
		exchanges,
		/** Where each key appeared in what the page sent. */
		async originsThatReceived(key: string): Promise<string[]> {
			const all = await Promise.all(sent);
			return [
				...new Set(
					all.filter((s) => s.text.includes(key)).map((s) => s.origin),
				),
			];
		},
		async totalSent(): Promise<number> {
			return (await Promise.all(sent)).length;
		},
	};
}

async function openSettings(page: Page) {
	await page.goto("/e2e/keys");
	await expect(
		page.getByRole("button", { name: "Add key" }).first(),
	).toBeVisible();
}

function providerRow(page: Page, name: string) {
	return page.getByRole("region", { name, exact: true });
}

async function addKey(page: Page, provider: string, key: string, mode: string) {
	const row = providerRow(page, provider);
	await row.getByRole("button", { name: "Add key" }).click();
	await row.getByLabel(`${provider} API key`).fill(key);
	await row.getByRole("radio", { name: mode }).check();
	await row.getByRole("button", { name: "Save key" }).click();
}

test("a remembered key survives a reload and goes only to its provider", async ({
	page,
}) => {
	const traffic = await interceptTraffic(page);
	await openSettings(page);

	await addKey(page, "OpenAI", OPENAI_KEY, "Remember on this device");
	const row = providerRow(page, "OpenAI");
	await expect(row).toContainText("••••abcd · Remembered on this device");
	await expect(page.locator("body")).not.toContainText(OPENAI_KEY);

	await page.reload();
	await expect(row).toContainText("••••abcd · Remembered on this device");
	await row.getByRole("button", { name: "Test key" }).click();
	await expect(row).toContainText("Key works · 2 models available");

	// What's on disk is ciphertext under a key the page can't export.
	const stored = await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const open = indexedDB.open("highelo-keys");
			open.onsuccess = () => resolve(open.result);
			open.onerror = () => reject(open.error);
		});
		const read = (store: string) =>
			new Promise<unknown[]>((resolve) => {
				const request = db.transaction(store).objectStore(store).getAll();
				request.onsuccess = () => resolve(request.result);
			});
		const [record] = (await read("keys")) as {
			secret: { ciphertext: ArrayBuffer };
		}[];
		const [deviceKey] = (await read("device")) as CryptoKey[];
		return {
			bytes: new TextDecoder("latin1").decode(record.secret.ciphertext),
			extractable: deviceKey.extractable,
			webStorage:
				JSON.stringify({ ...localStorage }) +
				JSON.stringify({ ...sessionStorage }),
		};
	});
	expect(stored.bytes).not.toContain(OPENAI_KEY);
	expect(stored.extractable).toBe(false);
	expect(stored.webStorage).not.toContain(OPENAI_KEY);

	expect(await traffic.totalSent()).toBeGreaterThan(0);
	expect(await traffic.originsThatReceived(OPENAI_KEY)).toEqual([
		"https://api.openai.com",
	]);
});

test("a session-only key works until a reload, then it's gone", async ({
	page,
}) => {
	const traffic = await interceptTraffic(page);
	await openSettings(page);

	await addKey(page, "Mistral", MISTRAL_KEY, "This session only");
	const row = providerRow(page, "Mistral");
	await expect(row).toContainText("••••wxyz · This session only");
	await row.getByRole("button", { name: "Test key" }).click();
	await expect(row).toContainText("Key works · 2 models available");

	await page.reload();
	await expect(row).toContainText("Not connected");
	expect(await traffic.originsThatReceived(MISTRAL_KEY)).toEqual([
		"https://api.mistral.ai",
	]);
});

test("a deleted key stays deleted after a reload", async ({ page }) => {
	await interceptTraffic(page);
	await openSettings(page);

	await addKey(page, "OpenAI", OPENAI_KEY, "Remember on this device");
	const row = providerRow(page, "OpenAI");
	await row.getByRole("button", { name: "Delete key" }).click();
	await expect(row).toContainText("Not connected");

	await page.reload();
	await expect(row).toContainText("Not connected");
});

test("a key the provider rejects says so", async ({ page }) => {
	await interceptTraffic(page);
	await page.route("https://api.openai.com/v1/models", (route) =>
		route.fulfill({
			status: 401,
			headers: CORS_HEADERS,
			json: { error: "bad key" },
		}),
	);
	await openSettings(page);

	await addKey(page, "OpenAI", OPENAI_KEY, "This session only");
	const row = providerRow(page, "OpenAI");
	await row.getByRole("button", { name: "Test key" }).click();
	await expect(row).toContainText("The provider rejected this key");
});

test("Connect OpenRouter mints a key with PKCE and keeps it out of the URL", async ({
	page,
}) => {
	const traffic = await interceptTraffic(page);
	await openSettings(page);

	await page.getByRole("button", { name: "Connect OpenRouter" }).click();
	await expect(page.getByText("OpenRouter is connected.")).toBeVisible();
	expect(new URL(page.url()).search).toBe("");

	const row = providerRow(page, "OpenRouter");
	await expect(row).toContainText(
		"••••beef · Remembered on this device · Connected with OpenRouter",
	);

	const [{ challenge }, exchange] = traffic.exchanges;
	expect(exchange.code).toBe("e2e-auth-code");
	expect(exchange.code_challenge_method).toBe("S256");
	expect(
		createHash("sha256").update(exchange.code_verifier).digest("base64url"),
	).toBe(challenge);

	await row.getByRole("button", { name: "Test key" }).click();
	await expect(row).toContainText("Key works");
	expect(await traffic.originsThatReceived(MINTED_OPENROUTER_KEY)).toEqual([
		"https://openrouter.ai",
	]);
	expect(await traffic.originsThatReceived(exchange.code_verifier)).toEqual([
		"https://openrouter.ai",
	]);
});

test("a planted OpenRouter callback connects nothing", async ({ page }) => {
	const traffic = await interceptTraffic(page);
	await page.goto("/e2e/keys?code=attacker-code&state=attacker-state");

	await expect(
		page.getByText("wasn't expecting an OpenRouter sign-in"),
	).toBeVisible();
	await expect(providerRow(page, "OpenRouter")).toContainText("Not connected");
	expect(traffic.exchanges).toEqual([]);
	expect(new URL(page.url()).search).toBe("");
});
