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
