import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";

// Roadmap 1.6: attach an image with the paperclip on the real /new route (picker, transport, OpenRouter
// provider, chat store), send it, find it in the request to the faked provider, and see it again after a
// reload. Claude Opus 5.5 reads images and PDFs in the seeded catalog; DeepSeek V4.1 Flash reads text only.

const KEY = "sk-or-v1-e2eFakeAttachKey0123456789ab";
const CORS_HEADERS = {
	"access-control-allow-origin": "*",
	"access-control-allow-headers": "*",
	"access-control-allow-methods": "GET, POST, OPTIONS",
};
// A 4×4 red PNG.
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEklEQVR4nGP4z8CAB+GTG8HSALfKY52fTcuYAAAAAElFTkSuQmCC",
	"base64",
);

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
	const completions: { messages: { role: string; content: unknown }[] }[] = [];
	await page.route("https://openrouter.ai/api/v1/chat/completions", (route) => {
		const request = route.request();
		if (request.method() === "OPTIONS") {
			return route.fulfill({ status: 204, headers: CORS_HEADERS });
		}
		completions.push(request.postDataJSON());
		return route.fulfill({
			headers: { ...CORS_HEADERS, "content-type": "text/event-stream" },
			body: sse("A red square."),
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

const attach = (page: Page, name: string, mimeType: string, buffer: Buffer) =>
	page.locator("input[type=file]").setInputFiles({ name, mimeType, buffer });

test("an attached image is sent to the provider and is still there after a reload", async ({
	page,
}) => {
	const completions = await fakeOpenRouter(page);
	await connectOpenRouter(page);
	await page.goto("/new");
	await pickModel(page, "Opus", "anthropic/claude-opus-5.5");

	await attach(page, "red.png", "image/png", PNG);
	await expect(page.getByText("red.png")).toBeVisible();
	const box = page.getByPlaceholder("Ask anything");
	await box.fill("What colour is this?");
	await box.press("Enter");
	await expect(page.getByText("A red square.")).toBeVisible();
	await expect(page).toHaveURL(/\/(?!new)[^/]+$/);
	// The composer let go of the file once it was sent.
	await expect(
		page.getByRole("button", { name: "Remove red.png" }),
	).toHaveCount(0);

	const user = completions[0]?.messages.find((m) => m.role === "user");
	expect(user?.content).toEqual([
		{
			type: "image_url",
			image_url: { url: expect.stringMatching(/^data:image\/png;base64,/) },
		},
		{ type: "text", text: "What colour is this?" },
	]);

	const shown = page.getByRole("img", { name: "red.png" });
	await expect(shown).toBeVisible();
	await page.reload();
	await expect(page.getByText("A red square.")).toBeVisible();
	await expect(shown).toBeVisible();
	await expect(shown).toHaveAttribute("src", /^data:image\/png;base64,/);
	expect(
		await shown.evaluate((img: HTMLImageElement) => img.naturalWidth),
	).toBe(4);
});

test("files are refused with a reason when attached, by type and by what the model reads", async ({
	page,
}) => {
	await connectOpenRouter(page);
	await page.goto("/new");
	await pickModel(page, "DeepSeek", "deepseek/deepseek-v4.1-flash");

	const refusals = page.getByRole("alert", { name: "Attachments not added" });
	await attach(page, "tool.exe", "application/x-msdownload", Buffer.from("MZ"));
	await expect(refusals).toContainText(
		"tool.exe can't be attached. Attach images (PNG, JPEG, WebP, GIF) or PDFs.",
	);
	await attach(page, "red.png", "image/png", PNG);
	await expect(refusals).toContainText(
		"This model can't read images, so red.png wasn't attached.",
	);
	await expect(page.getByText("red.png", { exact: true })).toHaveCount(0);
	await refusals.getByRole("button", { name: "Dismiss" }).click();
	await expect(refusals).toHaveCount(0);
});
