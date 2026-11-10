import { expect, test } from "./support/fixtures";
import { settingsDialog } from "./support/settings";

// Roadmap R2 S4: a notice under a chat's header once it nears (80%) or passes its context length,
// with a switch in Settings → Chat (/e2e/context-warning, src/lib/chat/context-usage.fixtures.ts).

const chat = (page: import("@playwright/test").Page, level: string) =>
	page.getByRole("region", { name: `Chat ${level}` });

test.beforeEach(async ({ page }) => {
	await page.goto("/e2e/context-warning");
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();
});

test("a chat near or past its context gets a notice; one well under it doesn't", async ({
	page,
}) => {
	await expect(chat(page, "nearing").getByRole("status")).toHaveText(
		"This chat has used 85% of its 128K context. Start a new chat, or pick a model with more context.",
	);
	await expect(chat(page, "over").getByRole("status")).toHaveText(
		"This chat is past its 128K context, so replies may fail or forget the start. Start a new chat, or pick a model with more context.",
	);
	await expect(chat(page, "under").getByRole("status")).toHaveCount(0);
});

test("the switch in Settings → Chat turns the notice off, and it stays off", async ({
	page,
}) => {
	await page.goto("/e2e/context-warning?settings=chat");
	const dialog = settingsDialog(page);
	const toggle = dialog.getByRole("switch", {
		name: "Context-length warnings",
	});
	await expect(toggle).toBeChecked();
	await toggle.click();
	await expect(toggle).not.toBeChecked();
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await expect(page.locator("[data-context-warning]")).toHaveCount(0);

	await page.reload();
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();
	await expect(page.locator("[data-context-warning]")).toHaveCount(0);
});
