import type { Page, Request } from "@playwright/test";
import { expect, test } from "./support/fixtures";

// Roadmap 2.2b: host choice on /e2e/chat-live (real picker, transport and providers), with OpenRouter
// and Fireworks faked and the routers' endpoint APIs answered from src/lib/hosts/test-endpoints.ts.
// The model is the seeded catalog's DeepSeek V4.1 Flash: on OpenRouter, Fireworks, DeepSeek and AI
// Gateway.

const MODEL = "deepseek/deepseek-v4.1-flash";
const FIREWORKS_MODEL = "accounts/fireworks/models/deepseek-v4p1-flash";
const KEYS = {
	openrouter: "sk-or-v1-e2eFakeHostKey0123456789aaaa",
	fireworks: "fw-e2eFakeHostKey0123456789bbbb",
};
const CORS_HEADERS = {
	"access-control-allow-origin": "*",
	"access-control-allow-headers": "*",
	"access-control-allow-methods": "GET, POST, OPTIONS",
};

function sse(
	provider: string | undefined,
	text: string,
	cost?: number,
): string {
	const base = {
		id: "gen-1",
		object: "chat.completion.chunk",
		created: 1,
		model: MODEL,
	};
	const chunks = [
		{
			...base,
			provider,
			choices: [{ index: 0, delta: { role: "assistant", content: text } }],
		},
		{
			...base,
			provider,
			choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
			usage: {
				prompt_tokens: 12,
				completion_tokens: 4,
				total_tokens: 16,
				cost,
			},
		},
	];
	return `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`;
}

/** Fakes both providers' chat completions, and records what the page sent where. */
async function fakeProviders(page: Page) {
	const sent: Promise<{ origin: string; text: string }>[] = [];
	const completions: { origin: string; body: Record<string, unknown> }[] = [];
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
	const fake =
		(reply: (body: Record<string, unknown>) => string) =>
		async (route: Parameters<Parameters<Page["route"]>[1]>[0]) => {
			const request = route.request();
			if (request.method() === "OPTIONS") {
				return route.fulfill({ status: 204, headers: CORS_HEADERS });
			}
			if (new URL(request.url()).pathname.endsWith("/chat/completions")) {
				const body = request.postDataJSON() as Record<string, unknown>;
				completions.push({ origin: new URL(request.url()).origin, body });
				return route.fulfill({
					headers: { ...CORS_HEADERS, "content-type": "text/event-stream" },
					body: reply(body),
				});
			}
			// Anything else (the endpoint APIs) falls through to the fixtures' fakes.
			return route.fallback();
		};
	await page.route(
		"https://openrouter.ai/api/v1/chat/completions",
		fake((body) => {
			const order = (body.provider as { order?: string[] } | undefined)?.order;
			const upstream =
				order?.[0] === "deepinfra/fp8" ? "DeepInfra" : "Fireworks";
			return sse(upstream, `Hello via ${upstream}.`, 0.000021);
		}),
	);
	await page.route(
		"https://api.fireworks.ai/**",
		fake(() => sse(undefined, "Hello from Fireworks direct.")),
	);
	return {
		completions,
		async originsThatReceived(secret: string) {
			const all = await Promise.all(sent);
			return [
				...new Set(
					all.filter((s) => s.text.includes(secret)).map((s) => s.origin),
				),
			];
		},
	};
}

async function connect(page: Page, provider: "OpenRouter" | "Fireworks") {
	const key = provider === "OpenRouter" ? KEYS.openrouter : KEYS.fireworks;
	await page.goto("/e2e/keys");
	const row = page.getByRole("region", { name: provider, exact: true });
	await row.getByRole("button", { name: "Add key" }).click();
	await row.getByLabel(`${provider} API key`).fill(key);
	await row.getByRole("radio", { name: "Remember on this device" }).check();
	await row.getByRole("button", { name: "Save key" }).click();
	await expect(row).toContainText(`••••${key.slice(-4)}`);
}

function picker(page: Page) {
	const dialog = page.getByRole("dialog", { name: "Choose a model" });
	const runWith = dialog.getByRole("region", { name: "Run with" });
	return {
		dialog,
		runWith,
		async open() {
			await page.getByRole("button", { name: /^Model: / }).click();
			await expect(dialog).toBeVisible();
		},
		async pickModel() {
			// Not in the High Elo set.
			await dialog.getByRole("button", { name: "All models" }).click();
			await dialog.getByLabel("Search models").fill("DeepSeek");
			await dialog
				.locator(`li[data-model="${MODEL}"]`)
				.getByRole("button")
				.click();
			await expect(dialog).toBeHidden();
		},
		host: (name: string) =>
			runWith.locator("[data-host]").filter({
				has: page.getByRole("button", { name: new RegExp(`^${name} \\(`) }),
			}),
		expand: (name: string) =>
			runWith.getByRole("button", { name: new RegExp(`^${name} \\(`) }).click(),
		upstream: (slug: string) =>
			runWith.locator(`button[data-upstream="${slug}"]`),
	};
}

async function send(page: Page, text: string) {
	const box = page.getByPlaceholder("Ask anything");
	await box.fill(text);
	await box.press("Enter");
}

test("Auto picks a connected host, and the reply says which host answered", async ({
	page,
}) => {
	const providers = await fakeProviders(page);
	await connect(page, "OpenRouter");
	await page.goto("/e2e/chat-live");
	const models = picker(page);
	await models.open();
	await models.pickModel();

	// One connected host: a quiet label, not a switcher.
	await expect(page.getByText("via OpenRouter", { exact: true })).toBeVisible();

	await send(page, "Hi there");
	await expect(page.getByText("Hello via Fireworks.")).toBeVisible();
	await expect(
		page.getByText(`${MODEL} · OpenRouter · via Fireworks · $0.000021`),
	).toBeVisible();

	// Auto leaves the upstream to OpenRouter (its default, most reliable, routing).
	expect(providers.completions).toHaveLength(1);
	expect(providers.completions[0]?.body).toMatchObject({ model: MODEL });
	expect(providers.completions[0]?.body.provider).toBeUndefined();
	expect(await providers.originsThatReceived(KEYS.openrouter)).toEqual([
		"https://openrouter.ai",
	]);
});

test("pinning an OpenRouter upstream sends provider routing options", async ({
	page,
}) => {
	const providers = await fakeProviders(page);
	await connect(page, "OpenRouter");
	await page.goto("/e2e/chat-live");
	const models = picker(page);
	await models.open();
	await models.pickModel();

	await models.open();
	await expect(
		models.runWith.getByRole("switch", { name: "Auto" }),
	).toBeChecked();
	await models.expand("OpenRouter");
	const deepInfra = models.upstream("deepinfra/fp8");
	await expect(deepInfra).toContainText("DeepInfra");
	await expect(deepInfra).toContainText("$0.08 / $0.3");
	await expect(deepInfra.getByText("Up", { exact: true })).toBeAttached();
	await expect(
		models.upstream("baseten").getByText("Slow or flaky lately"),
	).toBeAttached();
	await expect(
		models.upstream("reka").getByText("Down or failing"),
	).toBeAttached();
	await deepInfra.click();
	await expect(models.dialog).toBeHidden();
	await expect(page.getByText("via OpenRouter · DeepInfra")).toBeVisible();

	await send(page, "Hi there");
	await expect(page.getByText("Hello via DeepInfra.")).toBeVisible();
	expect(providers.completions[0]?.body.provider).toEqual({
		order: ["deepinfra/fp8"],
		allow_fallbacks: false,
	});

	// Auto again: no pin.
	await models.open();
	await models.runWith.getByRole("switch", { name: "Auto" }).click();
	await expect(
		models.runWith.getByRole("switch", { name: "Auto" }),
	).toBeChecked();
});

test("switching to a direct key sends the request to that origin only", async ({
	page,
}) => {
	const providers = await fakeProviders(page);
	await connect(page, "OpenRouter");
	await connect(page, "Fireworks");
	await page.goto("/e2e/chat-live");
	const models = picker(page);
	await models.open();
	await models.pickModel();

	// Two connected hosts: the label is a switcher.
	await page.getByRole("button", { name: /^Host: via OpenRouter/ }).click();
	await page.getByRole("menuitemradio", { name: /Fireworks/ }).click();
	await expect(
		page.getByRole("button", { name: "Host: via Fireworks" }),
	).toBeVisible();

	await send(page, "Hi there");
	await expect(page.getByText("Hello from Fireworks direct.")).toBeVisible();
	// No bill from Fireworks: the cost is estimated from its live prices.
	await expect(
		page.getByText(`${FIREWORKS_MODEL} · Fireworks · ~$0.0000034`),
	).toBeVisible();
	expect(providers.completions.map((completion) => completion.origin)).toEqual([
		"https://api.fireworks.ai",
	]);
	expect(providers.completions[0]?.body).toMatchObject({
		model: FIREWORKS_MODEL,
	});
	expect(await providers.originsThatReceived(KEYS.fireworks)).toEqual([
		"https://api.fireworks.ai",
	]);
	expect(await providers.originsThatReceived(KEYS.openrouter)).toEqual([]);
});

test("Hide unavailable hides hosts without a key and hosts that are down", async ({
	page,
}) => {
	await fakeProviders(page);
	await connect(page, "OpenRouter");
	await page.goto("/e2e/chat-live");
	const models = picker(page);
	await models.open();
	await models.pickModel();
	await models.open();

	const hosts = models.runWith.locator("[data-host]");
	await expect(hosts).toHaveCount(4);
	await expect(
		models.host("Fireworks").getByRole("link", { name: "Connect" }),
	).toHaveAttribute("href", "/settings");
	await expect(
		models.runWith.getByRole("button", { name: "Fireworks (Not connected)" }),
	).toBeVisible();

	await models.runWith
		.getByRole("switch", { name: "Hide unavailable" })
		.click();
	await expect(hosts).toHaveCount(1);
	await models.expand("OpenRouter");
	await expect(models.upstream("deepinfra/fp8")).toBeVisible();
	await expect(models.upstream("reka")).toHaveCount(0);

	// Kept in this browser.
	await page.reload();
	await models.open();
	await expect(
		models.runWith.getByRole("switch", { name: "Hide unavailable" }),
	).toBeChecked();
	await expect(hosts).toHaveCount(1);
});

test("the no-training filter excludes hosts and is enforced in the request", async ({
	page,
}) => {
	const providers = await fakeProviders(page);
	await connect(page, "OpenRouter");
	await page.goto("/e2e/chat-live");
	const models = picker(page);
	await models.open();
	await models.pickModel();
	await models.open();

	await models.runWith
		.getByRole("switch", { name: "Only hosts that don't train on my data" })
		.click();
	await expect(models.host("DeepSeek")).toContainText("May train on prompts");
	await expect(models.host("Fireworks")).not.toContainText("May train");
	await models.expand("OpenRouter");
	await expect(models.upstream("deepinfra/fp8")).toBeDisabled();
	await expect(models.upstream("deepinfra/fp8")).toContainText(
		"May train on prompts",
	);
	await expect(models.upstream("fireworks")).toBeEnabled();
	await page.keyboard.press("Escape");

	await send(page, "Hi there");
	await expect(page.getByText("Hello via Fireworks.")).toBeVisible();
	expect(providers.completions[0]?.body.provider).toEqual({
		data_collection: "deny",
	});
});

test("a choice saved for a host without a key ends up on a connected host", async ({
	page,
}) => {
	const providers = await fakeProviders(page);
	await connect(page, "OpenRouter");
	// What chats were stuck with: Fireworks saved while only an OpenRouter key exists (a pre-2.2b
	// choice, made before the keys had loaded).
	await page.evaluate(
		([model, fireworksModel]) =>
			localStorage.setItem(
				"highelo-model-choice",
				JSON.stringify({
					provider: "fireworks",
					model: fireworksModel,
					gatewayId: model,
				}),
			),
		[MODEL, FIREWORKS_MODEL],
	);
	await page.goto("/e2e/chat-live");
	await expect(
		page.getByRole("button", { name: "Model: DeepSeek V4.1 Flash" }),
	).toBeVisible();
	await expect(page.getByText("via OpenRouter", { exact: true })).toBeVisible();

	await send(page, "Hi there");
	await expect(page.getByText("Hello via Fireworks.")).toBeVisible();
	expect(providers.completions.map((completion) => completion.origin)).toEqual([
		"https://openrouter.ai",
	]);
});

test("a key added in another tab connects the chat without a reload", async ({
	page,
	context,
}) => {
	await fakeProviders(page);
	await page.goto("/e2e/chat-live");
	await page.evaluate(
		(model) =>
			localStorage.setItem(
				"highelo-model-choice",
				JSON.stringify({ provider: "openrouter", model, gatewayId: model }),
			),
		MODEL,
	);
	await page.reload();
	await expect(
		page.getByRole("link", { name: "Connect DeepSeek" }),
	).toBeVisible();

	const settings = await context.newPage();
	await connect(settings, "OpenRouter");
	await expect(page.getByText("via OpenRouter", { exact: true })).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Connect DeepSeek" }),
	).toHaveCount(0);
});
