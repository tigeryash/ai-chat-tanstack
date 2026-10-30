import { expect, test } from "./support/fixtures";

// The composer (src/components/chat/input.tsx) is a pill until the message gets long, gains a line
// break, or has files, then morphs into a card. Screenshots pin both resting states.

test.beforeEach(async ({ page }) => {
	await page.goto("/e2e/composer");
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();
});

test("is a pill while the message is short", async ({ page }) => {
	const composer = page.locator("form");

	await expect(composer).toHaveCSS("border-radius", "9999px");
	await expect(composer).toHaveScreenshot("composer-collapsed.png");
});

test("becomes a card for a multi-line message", async ({ page }) => {
	const composer = page.locator("form");

	await page
		.getByPlaceholder("Ask anything")
		.fill("First line\nSecond line\nThird line");

	await expect(composer).toHaveCSS("border-radius", "12px");
	await expect(composer).toHaveScreenshot("composer-expanded.png");
});

test("Shift+Enter adds a line instead of sending", async ({ page }) => {
	const textbox = page.getByPlaceholder("Ask anything");

	await textbox.pressSequentially("one");
	await textbox.press("Shift+Enter");
	await textbox.pressSequentially("two");

	await expect(textbox).toHaveValue("one\ntwo");
	await expect(page.locator("form")).toHaveCSS("border-radius", "12px");
	await expect(
		page
			.getByRole("list", { name: "Submitted messages" })
			.getByRole("listitem"),
	).toHaveCount(0);
});

test("Enter sends the trimmed message and clears the box", async ({ page }) => {
	const textbox = page.getByPlaceholder("Ask anything");

	await textbox.fill("  Hello there  ");
	await textbox.press("Enter");

	await expect(
		page
			.getByRole("list", { name: "Submitted messages" })
			.getByRole("listitem"),
	).toHaveText(["Hello there"]);
	await expect(textbox).toHaveValue("");
});

// A 1x1 PNG.
const PIXEL = {
	name: "pixel.png",
	mimeType: "image/png",
	buffer: Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
		"base64",
	),
};

test("an attached image can be previewed and removed", async ({ page }) => {
	await page.locator('input[type="file"]').setInputFiles(PIXEL);

	const enlarged = page.getByRole("img", { name: "pixel.png" });
	await page.getByRole("button", { name: "Preview pixel.png" }).click();
	await expect(enlarged).toBeInViewport();
	await page.keyboard.press("Escape");
	await expect(enlarged).toHaveCount(0);

	await page.getByRole("button", { name: "Preview pixel.png" }).click();
	// The X in the corner (the middle of the backdrop is under the image).
	await page
		.getByRole("button", { name: "Close preview" })
		.click({ position: { x: 20, y: 20 } });
	await expect(enlarged).toHaveCount(0);

	await page.getByRole("button", { name: "Remove pixel.png" }).click();
	await expect(
		page.getByRole("button", { name: "Preview pixel.png" }),
	).toHaveCount(0);
	await expect(page.locator("form")).toHaveCSS("border-radius", "9999px");
});

test("files dropped on the composer are attached", async ({ page }) => {
	const dataTransfer = await page.evaluateHandle(() => {
		const transfer = new DataTransfer();
		transfer.items.add(
			new File(["hello"], "notes.txt", { type: "text/plain" }),
		);
		return transfer;
	});

	await page.locator("form").dispatchEvent("drop", { dataTransfer });

	await expect(
		page.getByRole("button", { name: "Remove notes.txt" }),
	).toBeAttached();
});

test("every composer control has a name", async ({ page }) => {
	await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
	await page.getByRole("textbox", { name: "Message" }).fill("hi");
	await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Upload files" }),
	).toBeVisible();
});

test.describe("in dark mode", () => {
	test.use({ colorScheme: "dark" });

	test("takes its colors from the dark tokens", async ({ page }) => {
		const composer = page.locator("form");

		await expect(composer).toHaveScreenshot("composer-collapsed-dark.png");
		await page
			.getByPlaceholder("Ask anything")
			.fill("First line\nSecond line\nThird line");
		await expect(composer).toHaveCSS("border-radius", "12px");
		await expect(composer).toHaveScreenshot("composer-expanded-dark.png");
	});
});
