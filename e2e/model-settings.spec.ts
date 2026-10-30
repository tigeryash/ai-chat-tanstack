import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";

// Roadmap 2.4b: the settings panel on /e2e/chat-live (real picker, transport and OpenRouter provider),
// with OpenRouter's chat completions faked. Which controls show comes from the real 2.4a probe results
// (src/models/parameter-probe.generated.ts): through OpenRouter, DeepSeek V4.1 Flash accepted
// temperature and top_k; Claude Opus 5.5 rejected both. Opus's effort values come from the seeded
// catalog (src/lib/models/test-catalog.ts).

const KEY = "sk-or-v1-e2eFakeSettingsKey0123456789";
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
			choices: [{ index: 0, delta: { role: "assistant", content: text } }],
		},
		{ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
	];
	return `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`;
}

async function fakeOpenRouter(page: Page) {
	const completions: Record<string, unknown>[] = [];
	await page.route("https://openrouter.ai/api/v1/chat/completions", (route) => {
		const request = route.request();
		if (request.method() === "OPTIONS") {
			return route.fulfill({ status: 204, headers: CORS_HEADERS });
		}
		completions.push(request.postDataJSON());
		return route.fulfill({
			headers: { ...CORS_HEADERS, "content-type": "text/event-stream" },
			body: sse(`Reply ${completions.length}.`),
		});
	});
	return completions;
}

async function connectOpenRouter(page: Page) {
	await page.goto("/e2e/keys");
	const row = page.getByRole("region", { name: "OpenRouter", exact: true });
	await row.getByRole("button", { name: "Add key" }).click();
	await row.getByLabel("OpenRouter API key").fill(KEY);
	await row.getByRole("radio", { name: "Remember on this device" }).check();
	await row.getByRole("button", { name: "Save key" }).click();
	await expect(row).toContainText(`••••${KEY.slice(-4)}`);
}

async function pickModel(page: Page, search: string, gatewayId: string) {
	await page.getByRole("button", { name: /^Model: / }).click();
	const dialog = page.getByRole("dialog", { name: "Choose a model" });
	await dialog.getByRole("button", { name: "All models" }).click();
	await dialog.getByLabel("Search models").fill(search);
	await dialog
		.locator(`li[data-model="${gatewayId}"]`)
		.getByRole("button")
		.click();
	await expect(dialog).toBeHidden();
}

async function send(page: Page, text: string, reply: string) {
	const box = page.getByPlaceholder("Ask anything");
	await box.fill(text);
	await box.press("Enter");
	await expect(page.getByText(reply)).toBeVisible();
}

test("the panel shows each model's own settings, and only supported ones are sent", async ({
	page,
}) => {
	const completions = await fakeOpenRouter(page);
	await connectOpenRouter(page);
	await page.goto("/e2e/chat-live");

	await pickModel(page, "DeepSeek", "deepseek/deepseek-v4.1-flash");
	await page.getByRole("button", { name: "Model settings" }).click();
	const panel = page.getByRole("dialog", { name: "Model settings" });
	await expect(
		panel.getByRole("slider", { name: "Temperature" }),
	).toBeVisible();
	await expect(panel.getByLabel("Reasoning effort")).toHaveCount(0);
	await panel.getByLabel("Temperature value").fill("0.3");
	await panel.getByLabel("Top K").fill("20");
	await panel
		.getByLabel("System prompt for this chat")
		.fill("Answer in one word.");
	await panel.getByLabel("System prompt for this chat").blur();
	await expect(panel.getByText("This chat's own prompt.")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(panel).toBeHidden();

	await send(page, "Hi", "Reply 1.");
	expect(completions[0]).toMatchObject({
		model: "deepseek/deepseek-v4.1-flash",
		temperature: 0.3,
		top_k: 20,
		messages: [
			{ role: "system", content: "Answer in one word." },
			{ role: "user", content: "Hi" },
		],
	});

	// Opus rejected temperature and top_k in the probe: the controls go, and the values stay in the
	// chat's settings but are stripped from the request.
	await pickModel(page, "Opus", "anthropic/claude-opus-5.5");
	await page.getByRole("button", { name: "Model settings" }).click();
	await expect(panel.getByRole("slider", { name: "Temperature" })).toHaveCount(
		0,
	);
	await expect(panel.getByLabel("Top K")).toHaveCount(0);
	const effort = panel.getByLabel("Reasoning effort");
	await expect(effort.locator("option")).toHaveText([
		"Default",
		"low",
		"medium",
		"high",
		"xhigh",
		"max",
	]);
	await effort.selectOption("high");
	await page.keyboard.press("Escape");

	await send(page, "Again", "Reply 2.");
	const second = completions[1] ?? {};
	expect(second).toMatchObject({
		model: "anthropic/claude-opus-5.5",
		reasoning: { effort: "high" },
	});
	expect(second).not.toHaveProperty("temperature");
	expect(second).not.toHaveProperty("top_k");
});

test("reset clears the settings, and a new chat starts from the model's last ones", async ({
	page,
}) => {
	await fakeOpenRouter(page);
	await connectOpenRouter(page);
	await page.goto("/e2e/chat-live");
	await pickModel(page, "DeepSeek", "deepseek/deepseek-v4.1-flash");

	const panel = page.getByRole("dialog", { name: "Model settings" });
	await page.getByRole("button", { name: "Model settings" }).click();
	await panel.getByLabel("Seed").fill("42");
	await page.keyboard.press("Escape");

	// A fresh chat with the same model starts from the last-used set.
	await page.reload();
	await page.getByRole("button", { name: "Model settings" }).click();
	await expect(panel.getByLabel("Seed")).toHaveValue("42");
	await panel.getByRole("button", { name: "Reset to defaults" }).click();
	await expect(panel.getByLabel("Seed")).toHaveValue("");
});
