import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { settingsDialog } from "./support/settings";

// Roadmap R2 S3: host preferences in Settings → Models & hosts, on /e2e/chat-live with OpenRouter and
// Fireworks faked and the routers' endpoint APIs answered from src/lib/hosts/endpoints.fixtures.ts.
// A blocked host leaves Auto, is marked in "Run with" and can still be pinned; the request to
// OpenRouter carries `ignore`, `quantizations` and `max_price`.

const MODEL = "deepseek/deepseek-v4.1-flash";
const KEYS = {
	OpenRouter: "sk-or-v1-e2eFakePrefsKey0123456789aaa",
	Fireworks: "fw-e2eFakePrefsKey0123456789bbbb",
};
const CORS_HEADERS = {
	"access-control-allow-origin": "*",
	"access-control-allow-headers": "*",
	"access-control-allow-methods": "GET, POST, OPTIONS",
};

function sse(text: string): string {
	const base = { id: "gen-1", object: "chat.completion.chunk", created: 1 };
	const chunks = [
		{
			...base,
			model: MODEL,
			provider: "Baseten",
			choices: [{ index: 0, delta: { role: "assistant", content: text } }],
		},
		{ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
	];
	return `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`;
}

async function fakeCompletions(page: Page) {
	const bodies: Record<string, unknown>[] = [];
	await page.route("https://openrouter.ai/api/v1/chat/completions", (route) => {
		const request = route.request();
		if (request.method() === "OPTIONS") {
			return route.fulfill({ status: 204, headers: CORS_HEADERS });
		}
		bodies.push(request.postDataJSON());
		return route.fulfill({
			headers: { ...CORS_HEADERS, "content-type": "text/event-stream" },
			body: sse("Hello within your preferences."),
		});
	});
	return bodies;
}

async function connect(page: Page, provider: keyof typeof KEYS) {
	await page.goto("/e2e/keys");
	const row = page.getByRole("region", { name: provider, exact: true });
	await row.getByRole("button", { name: "Add key" }).click();
	await row.getByLabel(`${provider} API key`).fill(KEYS[provider]);
	await row.getByRole("radio", { name: "Remember on this device" }).check();
	await row.getByRole("button", { name: "Save key" }).click();
	await expect(row).toContainText(`••••${KEYS[provider].slice(-4)}`);
}

function picker(page: Page) {
	const dialog = page.getByRole("dialog", { name: "Choose a model" });
	const runWith = dialog.getByRole("region", { name: "Run with" });
	const hostButton = (name: string) =>
		runWith.getByRole("button", { name: new RegExp(`^${name} \\(`) });
	return {
		dialog,
		async open() {
			await page.getByRole("button", { name: /^Model: / }).click();
			await expect(dialog).toBeVisible();
		},
		host: (name: string) =>
			runWith.locator("[data-host]").filter({
				has: page.getByRole("button", { name: new RegExp(`^${name} \\(`) }),
			}),
		expand: (name: string) => hostButton(name).click(),
		upstream: (slug: string) =>
			runWith.locator(`button[data-upstream="${slug}"]`),
	};
}

test("host preferences steer Auto and reach OpenRouter's routing", async ({
	page,
}, testInfo) => {
	const bodies = await fakeCompletions(page);
	await connect(page, "OpenRouter");
	await connect(page, "Fireworks");
	await page.goto("/e2e/chat-live");
	const models = picker(page);
	await models.open();
	await models.dialog.getByRole("button", { name: "All models" }).click();
	await models.dialog.getByLabel("Search models").fill("DeepSeek");
	await models.dialog
		.locator(`li[data-model="${MODEL}"]`)
		.getByRole("button")
		.click();
	await expect(models.dialog).toBeHidden();

	// Before: Auto expects OpenRouter to land on DeepInfra, and nothing is marked.
	await models.open();
	await models.expand("OpenRouter");
	await expect(models.upstream("deepinfra/fp8")).toContainText(
		"Auto's likely pick",
	);
	await expect(models.dialog.locator("[data-skipped]")).toHaveCount(0);
	await page.keyboard.press("Escape");

	// Settings → Models & hosts.
	await page.goto("/e2e/chat-live?settings=models");
	const settings = settingsDialog(page);
	const blocked = settings.getByRole("region", { name: "Blocked hosts" });
	await expect(blocked).toContainText("No hosts blocked.");
	for (const name of ["deepinfra", "Fireworks"]) {
		await blocked.getByLabel("Host to block").fill(name);
		await blocked.getByRole("button", { name: "Block", exact: true }).click();
	}
	// Named by host, as the suggestions spell it.
	await expect(
		blocked.getByRole("button", { name: "Unblock DeepInfra" }),
	).toBeVisible();
	await expect(
		blocked.getByRole("button", { name: "Unblock Fireworks" }),
	).toBeVisible();
	await settings
		.getByLabel("Exclude quantized")
		.selectOption({ label: "fp8 or better" });
	const cap = settings.getByRole("region", { name: "Price cap for Auto" });
	await cap.getByLabel("Input (prompt)").fill("1");
	await cap.getByLabel("Output (completion)").fill("2");
	await testInfo.attach("models-and-hosts", {
		body: await settings.screenshot(),
		contentType: "image/png",
	});

	// Kept in this browser.
	await page.reload();
	await expect(
		blocked.getByRole("button", { name: "Unblock Fireworks" }),
	).toBeVisible();
	await expect(cap.getByLabel("Output (completion)")).toHaveValue("2");
	await page.keyboard.press("Escape");
	await expect(settings).toBeHidden();

	// After: the blocked direct host is marked and isn't Auto's pick, but can still be pinned.
	await expect(
		page.getByRole("button", { name: "Host: via OpenRouter" }),
	).toBeVisible();
	await models.open();
	const fireworks = models.host("Fireworks");
	await expect(fireworks.locator('[data-skipped="blocked"]')).toHaveText(
		"Blocked",
	);
	await expect(fireworks).not.toContainText("Auto's pick");
	await expect(models.host("OpenRouter")).toContainText("In use · Auto");
	await models.expand("Fireworks");
	await expect(
		fireworks.getByRole("button", { name: "Use Fireworks" }),
	).toBeEnabled();
	// DeepInfra on OpenRouter: marked, no longer Auto's likely pick, still pickable.
	await models.expand("OpenRouter");
	const deepInfra = models.upstream("deepinfra/fp8");
	await expect(deepInfra.locator('[data-skipped="blocked"]')).toBeVisible();
	await expect(deepInfra).not.toContainText("Auto's likely pick");
	await expect(deepInfra).toBeEnabled();
	await page.keyboard.press("Escape");

	const box = page.getByPlaceholder("Ask anything");
	await box.fill("Hi there");
	await box.press("Enter");
	await expect(page.getByText("Hello within your preferences.")).toBeVisible();
	expect(bodies).toHaveLength(1);
	expect(bodies[0]?.provider).toEqual({
		ignore: ["deepinfra", "fireworks"],
		quantizations: ["int8", "fp8", "mxfp8", "fp16", "bf16", "fp32", "unknown"],
		max_price: { prompt: 1, completion: 2 },
	});
});
