import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";

// The chat store (roadmap 1.3) in a real browser, on /e2e/storage. Each test gets a fresh browser
// context, so a fresh IndexedDB.

async function open(page: Page) {
	await page.goto("/e2e/storage");
	await expect(page.locator("main[data-ready='true']")).toBeAttached();
}

async function press(page: Page, label: string) {
	await page.getByRole("button", { name: label, exact: true }).click();
}

const chatList = (page: Page) => page.getByRole("list", { name: "Chats" });
const chat = (page: Page, id: string) => page.locator(`[data-chat-id='${id}']`);

test("a saved chat survives a reload, and works offline", async ({
	page,
	context,
}) => {
	await open(page);
	await press(page, "Save chat");
	await expect(chat(page, "sample")).toContainText("Hello storage");
	await expect(page.getByRole("status")).toHaveText(
		/^Persistence: (persisted|not-persisted)$/,
	);

	await page.reload();
	await expect(page.locator("main[data-ready='true']")).toBeAttached();
	await expect(chat(page, "sample")).toContainText(
		"Hello storageSaved locally",
	);

	// Reading and writing need no network.
	await context.setOffline(true);
	await press(page, "Rename chat");
	await expect(chat(page, "sample").getByRole("heading")).toHaveText(
		"Renamed sample",
	);
	await context.setOffline(false);
});

test("a v0 chat loads through migration", async ({ page }) => {
	await open(page);
	await press(page, "Seed v0 chat");
	await page.reload();
	await expect(page.locator("main[data-ready='true']")).toBeAttached();

	const migrated = chat(page, "chat-v0");
	await expect(migrated.getByRole("heading")).toHaveText("hi");
	await expect(migrated.getByRole("listitem")).toHaveText([
		"hi",
		"Hello! How can I help?",
		"what's the weather, and see this",
		"It's 4°C in Toronto.",
		"thanks",
	]);
});

test("export → wipe → import restores everything", async ({ page }) => {
	await open(page);
	await press(page, "Save chat");
	await press(page, "Rename chat");
	await press(page, "Seed v0 chat");
	await expect(chatList(page).locator("[data-chat-id]")).toHaveCount(2);
	const before = await chatList(page).textContent();

	await press(page, "Export");
	await expect(page.getByRole("status")).toHaveText("Exported 2");
	await press(page, "Wipe");
	await expect(page.getByRole("status")).toHaveText("Wiped");
	await expect(chatList(page).locator("[data-chat-id]")).toHaveCount(0);

	await press(page, "Import");
	await expect(page.getByRole("status")).toHaveText("Imported 2");
	expect(await chatList(page).textContent()).toBe(before);

	await page.reload();
	await expect(page.locator("main[data-ready='true']")).toBeAttached();
	expect(await chatList(page).textContent()).toBe(before);
});
