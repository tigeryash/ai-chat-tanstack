import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import {
	connectOpenRouter,
	fakeOpenRouter,
	PNG,
	pickModel,
} from "./support/openrouter";

// Roadmap 1.6: attach an image with the paperclip on the real /new route (picker, transport, OpenRouter
// provider, chat store), send it, find it in the request to the faked provider, and see it again after a
// reload. Claude Opus 5.5 reads images and PDFs in the seeded catalog; DeepSeek V4.1 Flash reads text only.
// Roadmap 1.6b: a text or code file goes to any model as a text part with its name and content.

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
		"tool.exe can't be attached. Attach images (PNG, JPEG, WebP, GIF), PDFs, or text and code files.",
	);
	await attach(page, "red.png", "image/png", PNG);
	await expect(refusals).toContainText(
		"This model can't read images, so red.png wasn't attached.",
	);
	await expect(page.getByText("red.png", { exact: true })).toHaveCount(0);
	await refusals.getByRole("button", { name: "Dismiss" }).click();
	await expect(refusals).toHaveCount(0);
});

test("a code file goes to a text-only model as text and is still there after a reload (1.6b)", async ({
	page,
}) => {
	const completions = await fakeOpenRouter(page);
	await connectOpenRouter(page);
	await page.goto("/new");
	await pickModel(page, "DeepSeek", "deepseek/deepseek-v4.1-flash");

	// Browsers often report no type for code files; the extension decides.
	await attach(page, "main.py", "", Buffer.from("print('hi')\n"));
	await expect(
		page.getByRole("button", { name: "Remove main.py" }),
	).toBeAttached();
	const box = page.getByPlaceholder("Ask anything");
	await box.fill("What does this print?");
	await box.press("Enter");
	await expect(page.getByText("A red square.")).toBeVisible();
	await expect(page).toHaveURL(/\/(?!new)[^/]+$/);

	const user = completions[0]?.messages.find((m) => m.role === "user");
	expect(user?.content).toEqual([
		{ type: "text", text: "File: main.py\n```python\nprint('hi')\n\n```" },
		{ type: "text", text: "What does this print?" },
	]);

	const chip = page.getByText("main.py · text/plain");
	await expect(chip).toBeVisible();
	await page.reload();
	await expect(page.getByText("A red square.")).toBeVisible();
	await expect(chip).toBeVisible();
});

test("a binary file named .txt is refused when attached (1.6b)", async ({
	page,
}) => {
	await page.goto("/new");
	await attach(
		page,
		"fake.txt",
		"text/plain",
		Buffer.from([0xff, 0xfe, 0, 0x81]),
	);
	await expect(
		page.getByRole("alert", { name: "Attachments not added" }),
	).toContainText("fake.txt isn't a UTF-8 text file, so it wasn't attached.");
	await expect(page.getByText("fake.txt", { exact: true })).toHaveCount(0);
});
