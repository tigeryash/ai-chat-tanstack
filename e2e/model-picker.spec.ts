import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";

// Roadmap 2.1b + 2.2: the model picker and model card on /e2e/model-picker, against the seeded catalog
// the Convex stub serves (src/lib/models/test-catalog.ts). The model is MockLanguageModelV4; its reply
// names the provider and model id the request was routed to.

const OPENROUTER_KEY = "sk-or-v1-e2eFakePickerKey0123456789beef";

async function connectOpenRouter(page: Page) {
	await page.goto("/e2e/keys");
	const row = page.getByRole("region", { name: "OpenRouter", exact: true });
	await row.getByRole("button", { name: "Add key" }).click();
	await row.getByLabel("OpenRouter API key").fill(OPENROUTER_KEY);
	await row.getByRole("radio", { name: "Remember on this device" }).check();
	await row.getByRole("button", { name: "Save key" }).click();
	await expect(row).toContainText("••••beef");
}

function picker(page: Page) {
	const dialog = page.getByRole("dialog", { name: "Choose a model" });
	return {
		dialog,
		async open() {
			await page.getByRole("button", { name: /^Model: / }).click();
			await expect(dialog).toBeVisible();
		},
		/** Gateway ids of the listed catalog models, in order. */
		listed: () =>
			dialog
				.getByRole("region", { name: "Models" })
				.locator("li[data-model]")
				.evaluateAll((rows) =>
					rows.map((row) => row.getAttribute("data-model")),
				),
		row: (gatewayId: string) => dialog.locator(`li[data-model="${gatewayId}"]`),
	};
}

test("search, filters, sort and the High Elo / All toggle", async ({
	page,
}) => {
	await page.goto("/e2e/model-picker");
	const models = picker(page);
	await models.open();

	// Opens on High Elo, best Intelligence Index first.
	await expect(
		models.dialog.getByRole("button", { name: "High Elo" }),
	).toHaveAttribute("aria-pressed", "true");
	await expect
		.poll(models.listed)
		.toEqual([
			"anthropic/claude-opus-5.5",
			"openai/gpt-5.5",
			"spacexai/grok-4.7",
			"google/gemini-3.8-flash",
		]);

	await models.dialog.getByRole("button", { name: "All models" }).click();
	await expect.poll(async () => (await models.listed()).length).toBe(7);

	await models.dialog.getByLabel("Search models").fill("claude");
	await expect
		.poll(models.listed)
		.toEqual(["anthropic/claude-opus-5.5", "anthropic/claude-sonnet-5"]);
	await models.dialog.getByLabel("Search models").fill("");

	await models.dialog.getByLabel("Developer").selectOption("openai");
	await expect.poll(models.listed).toEqual(["openai/gpt-5.5"]);
	await models.dialog.getByLabel("Developer").selectOption("");

	await models.dialog.getByRole("button", { name: "Open weights" }).click();
	await expect
		.poll(models.listed)
		.toEqual(["moonshotai/kimi-k3", "deepseek/deepseek-v4.1-flash"]);
	await models.dialog.getByLabel("Sort").selectOption("price");
	await expect
		.poll(models.listed)
		.toEqual(["deepseek/deepseek-v4.1-flash", "moonshotai/kimi-k3"]);
	await models.dialog.getByRole("button", { name: "Open weights" }).click();

	await models.dialog.getByLabel("Context").selectOption("1000000");
	await models.dialog.getByLabel("Sort").selectOption("newest");
	await expect
		.poll(models.listed)
		.toEqual(["anthropic/claude-opus-5.5", "google/gemini-3.8-flash"]);

	await models.dialog.getByLabel("Context").selectOption("");
	await models.dialog.getByLabel("Price").selectOption("1");
	await expect
		.poll(models.listed)
		.toEqual(["google/gemini-3.8-flash", "deepseek/deepseek-v4.1-flash"]);
});

test("picking a runnable model streams a reply, and becomes the default", async ({
	page,
}) => {
	await connectOpenRouter(page);
	await page.goto("/e2e/model-picker");

	// With OpenRouter connected, the best runnable High Elo model is picked and its card shown.
	await expect(
		page.getByRole("button", { name: "Model: Claude Opus 5.5" }),
	).toBeVisible();
	const card = page.getByRole("article", { name: "About Claude Opus 5.5" });
	await expect(card).toContainText("Anthropic · via OpenRouter");
	await expect(card).toContainText("1M");
	await expect(card).toContainText("$5 / M tokens");
	await expect(card).toContainText("$25 / M tokens");
	await expect(card).toContainText("anthropic, bedrock, vertex");
	await expect(card).toContainText("Mar 2026");
	await expect(card).toContainText("Aug 2026");
	await expect(card).toContainText("74");
	await expect(
		card.getByRole("link", { name: "by Artificial Analysis" }),
	).toHaveAttribute("href", "https://artificialanalysis.ai");
	await expect(card).toContainText("Zero data retention");
	await expect(card).toContainText("No training on prompts");

	const models = picker(page);
	await models.open();
	await models.row("openai/gpt-5.5").getByRole("button").click();
	await expect(models.dialog).toBeHidden();
	await expect(
		page.getByRole("article", { name: "About GPT-5.5" }),
	).toContainText("Zero data retention on some providers");

	const box = page.getByPlaceholder("Ask anything");
	await box.fill("Hi there");
	await box.press("Enter");
	await expect(
		page.getByText("Mock reply from openai/gpt-5.5 via openrouter."),
	).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: /^via OpenRouter · <\$0\.0001\. openai\/gpt-5\.5 · OpenRouter · ~\$/,
		}),
	).toBeVisible();

	// A new chat starts on the last choice.
	await page.goto("/e2e/model-picker");
	await expect(
		page.getByRole("button", { name: "Model: GPT-5.5" }),
	).toBeVisible();
});

test("a model no connection serves links to Settings", async ({ page }) => {
	await connectOpenRouter(page);
	await page.goto("/e2e/model-picker");
	const models = picker(page);
	await models.open();

	// Grok isn't on OpenRouter: only an xAI key runs it.
	const grok = models.row("spacexai/grok-4.7");
	await expect(grok.getByRole("button")).toHaveCount(0);
	await expect(grok.getByRole("link", { name: "Connect xAI" })).toHaveAttribute(
		"href",
		"/settings",
	);
	await expect(models.row("openai/gpt-5.5")).toContainText("via OpenRouter");
});

test("with nothing connected, every model offers its provider's connect link", async ({
	page,
}) => {
	await page.goto("/e2e/model-picker");
	await expect(
		page.getByRole("button", { name: "Model: Pick a model" }),
	).toBeVisible();
	await expect(page.getByText("Pick a model to start.")).toBeVisible();

	const models = picker(page);
	await models.open();
	await expect(
		models
			.row("anthropic/claude-opus-5.5")
			.getByRole("link", { name: "Connect Anthropic" }),
	).toHaveAttribute("href", "/settings");
	await expect(
		models.dialog.getByRole("region", { name: "Local" }),
	).toContainText("add a local server in Settings");
});

test("a chat whose model was removed shows a banner with the family's newest model", async ({
	page,
}) => {
	await page.goto("/e2e/model-picker");
	await page.evaluate(() =>
		localStorage.setItem(
			"highelo-chat-models",
			JSON.stringify([
				[
					"old-chat",
					{
						provider: "openrouter",
						model: "anthropic/claude-sonnet-4.5",
						gatewayId: "anthropic/claude-sonnet-4.5",
					},
				],
			]),
		),
	);
	await page.goto("/e2e/model-picker?chat=old-chat");

	const banner = page
		.getByRole("status")
		.filter({ hasText: "no longer offered" });
	await expect(banner).toContainText(
		"Claude Sonnet 4.5 is no longer offered (removed Oct 2026). The newest in its family is Claude Sonnet 5.",
	);
	await banner
		.getByRole("button", { name: "Switch to Claude Sonnet 5" })
		.click();
	await expect(banner).toBeHidden();
	await expect(
		page.getByRole("button", { name: "Model: Claude Sonnet 5" }),
	).toBeVisible();
});
