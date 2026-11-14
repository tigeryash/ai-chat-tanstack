import type { Page } from "@playwright/test";
import { e2eMockModel, e2eMockReply } from "../src/lib/chat/e2e-model";
import { expect, test } from "./support/fixtures";
import { settingsDialog } from "./support/settings";
import { composer, pickModel, setUp, status } from "./support/workspaces";

// Roadmap R2 S2: Settings → General picks the model new chats start on, and a model that writes chat
// titles. Every model here is the e2e mock on the stubbed local server (hard rule 6).

const main = (page: Page) => page.locator("main");
const recent = (page: Page) =>
	page.getByRole("list", { name: "Recent chats" }).getByRole("link");

async function send(page: Page, text: string, reply: string) {
	await composer(main(page)).fill(text);
	await composer(main(page)).press("Enter");
	await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);
	await expect(main(page).getByText(reply).last()).toBeVisible();
	await expect(status(main(page))).toHaveAttribute("data-chat-status", "ready");
}

const row = (page: Page, id: string) => page.locator(`#setting-${id}`);

test.beforeEach(async ({ context, page }) => {
	await setUp(context, page, e2eMockModel("alpha"));
});

test("a fixed default model starts new chats after a reload, whatever was picked last", async ({
	page,
}) => {
	await page.goto("/new?settings=general");
	const defaults = row(page, "default-model");
	await expect(
		defaults.getByRole("radio", { name: "The model I used last" }),
	).toBeChecked();
	await defaults.getByRole("radio", { name: "Always this model" }).click();
	await pickModel(defaults, page, e2eMockModel("beta"));
	await page.keyboard.press("Escape");
	await expect(settingsDialog(page)).toHaveCount(0);

	await page.reload();
	await expect(
		main(page).getByRole("button", { name: /^Model: / }),
	).toContainText(e2eMockModel("beta"));

	// Picking another model in a chat changes that chat, not where new chats start.
	await pickModel(main(page), page, e2eMockModel("gamma"));
	await send(page, "First", e2eMockReply("gamma"));
	await page.getByRole("link", { name: "New chat" }).click();
	await expect(page).toHaveURL(/\/new$/);
	await expect(
		main(page).getByRole("button", { name: /^Model: / }),
	).toContainText(e2eMockModel("beta"));

	// Back to "last used": the last pick starts new chats again.
	await page.goto("/new?settings=general");
	await row(page, "default-model")
		.getByRole("radio", { name: "The model I used last" })
		.click();
	await page.keyboard.press("Escape");
	await page.reload();
	await expect(
		main(page).getByRole("button", { name: /^Model: / }),
	).toContainText(e2eMockModel("gamma"));
});

test("the title model names a new chat once; off, the first line does", async ({
	page,
}) => {
	await page.goto("/new");
	await send(page, "Plan a trip to Lisbon", e2eMockReply("alpha"));
	await expect(recent(page)).toHaveText(["Plan a trip to Lisbon"]);

	await page.goto("/new?settings=general");
	const titles = row(page, "title-model");
	await titles
		.getByRole("switch", { name: "Write titles with a model" })
		.click();
	await pickModel(titles, page, e2eMockModel("gamma"));
	await page.keyboard.press("Escape");
	await expect(settingsDialog(page)).toHaveCount(0);

	// The mock title model answers "Hello from gamma.", which becomes the title.
	await send(page, "Tax questions for 2026", e2eMockReply("alpha"));
	await expect(recent(page).first()).toHaveText("Hello from gamma");
	await page.reload();
	await expect(recent(page)).toHaveText([
		"Hello from gamma",
		"Plan a trip to Lisbon",
	]);
	// A second message doesn't rename it.
	await send(page, "And deductions?", e2eMockReply("alpha"));
	await expect(recent(page).first()).toHaveText("Hello from gamma");
});
