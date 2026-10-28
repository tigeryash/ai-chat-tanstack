import type { Page } from "@playwright/test";
import { E2E_MOCK_MODEL, E2E_MOCK_REPLY } from "../src/lib/chat/e2e-model";
import { MODEL_CHOICE_STORAGE_KEY } from "../src/lib/chat/model-selection";
import { expect, test } from "./support/fixtures";

// Roadmap 1.4 and 1.5: a signed-out visitor chats on the real `/new` route (the AI SDK mock model,
// switched on by VITE_E2E builds) and manages the chat from the sidebar. Everything stays in this
// browser's IndexedDB, so it survives a reload.

const replyText = E2E_MOCK_REPLY.join("");

test.beforeEach(async ({ page }) => {
	await page.addInitScript(
		([key, model]) =>
			localStorage.setItem(key, JSON.stringify({ provider: "local", model })),
		[MODEL_CHOICE_STORAGE_KEY, E2E_MOCK_MODEL],
	);
});

async function chat(page: Page, text: string) {
	const box = page.getByPlaceholder("Ask anything");
	await box.fill(text);
	await box.press("Enter");
	await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);
	await expect(page.getByText(replyText)).toBeVisible();
	await expect(page.locator("[data-chat-status]")).toHaveAttribute(
		"data-chat-status",
		"ready",
	);
}

const group = (page: Page, name: "Pinned" | "Recent") =>
	page.getByRole("list", { name: `${name} chats` });

async function openMenu(page: Page, title: string) {
	await page.getByRole("button", { name: `Options for ${title}` }).click();
}

test("a signed-out visitor chats, then renames, pins, searches and deletes in the sidebar", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page).toHaveURL(/\/new$/);
	await expect(page.getByText("Your chats will show up here.")).toBeVisible();

	await chat(page, "Plan a trip to Lisbon");
	const trip = page.getByRole("link", { name: "Plan a trip to Lisbon" });
	await expect(group(page, "Recent").getByRole("link")).toHaveText([
		"Plan a trip to Lisbon",
	]);
	await expect(trip).toHaveAttribute("data-active", "");

	await page.getByRole("link", { name: "New chat" }).click();
	await expect(page).toHaveURL(/\/new$/);
	await expect(page.getByText("Send a message to start.")).toBeVisible();
	await chat(page, "Tax questions");
	// Newest first.
	await expect(group(page, "Recent").getByRole("link")).toHaveText([
		"Tax questions",
		"Plan a trip to Lisbon",
	]);

	// Pin: pinned chats come first, in their own group.
	await openMenu(page, "Plan a trip to Lisbon");
	await page.getByRole("menuitem", { name: "Pin" }).click();
	await expect(group(page, "Pinned").getByRole("link")).toHaveText([
		"Plan a trip to Lisbon",
	]);
	await expect(group(page, "Recent").getByRole("link")).toHaveText([
		"Tax questions",
	]);

	// Rename.
	await openMenu(page, "Tax questions");
	await page.getByRole("menuitem", { name: "Rename" }).click();
	const titleField = page.getByLabel("Chat title");
	await titleField.fill("Taxes 2026");
	await titleField.press("Enter");
	await expect(group(page, "Recent").getByRole("link")).toHaveText([
		"Taxes 2026",
	]);

	// Search by title.
	const search = page.getByRole("searchbox", { name: "Search chats" });
	await search.fill("LISBON");
	await expect(page.getByRole("link", { name: "Taxes 2026" })).toHaveCount(0);
	await expect(trip).toBeVisible();
	await search.fill("nothing like this");
	await expect(page.getByText("No chats match your search.")).toBeVisible();
	await search.fill("");

	// Everything is in IndexedDB: a reload brings the list back as it was.
	await page.reload();
	await expect(group(page, "Pinned").getByRole("link")).toHaveText([
		"Plan a trip to Lisbon",
	]);
	await expect(group(page, "Recent").getByRole("link")).toHaveText([
		"Taxes 2026",
	]);

	// Delete asks first; cancelling keeps the chat.
	await openMenu(page, "Plan a trip to Lisbon");
	await page.getByRole("menuitem", { name: "Delete" }).click();
	const confirm = page.getByRole("alertdialog", { name: "Delete this chat?" });
	await confirm.getByRole("button", { name: "Cancel" }).click();
	await expect(trip).toBeVisible();

	await openMenu(page, "Plan a trip to Lisbon");
	await page.getByRole("menuitem", { name: "Delete" }).click();
	await confirm.getByRole("button", { name: "Delete" }).click();
	await expect(trip).toHaveCount(0);

	// Deleting the open chat goes back to a new one.
	await openMenu(page, "Taxes 2026");
	await page.getByRole("menuitem", { name: "Delete" }).click();
	await confirm.getByRole("button", { name: "Delete" }).click();
	await expect(page).toHaveURL(/\/new$/);
	await expect(page.getByText("Your chats will show up here.")).toBeVisible();

	await page.reload();
	await expect(page.getByText("Your chats will show up here.")).toBeVisible();
});

test("on a narrow screen the sidebar opens from the header button", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 800 });
	await page.goto("/new");
	await chat(page, "Small screen chat");

	const link = page.getByRole("link", { name: "Small screen chat" });
	await expect(link).toBeHidden();
	await page.getByRole("button", { name: "Toggle sidebar" }).click();
	await expect(link).toBeVisible();

	await page.getByRole("link", { name: "New chat" }).click();
	await expect(page).toHaveURL(/\/new$/);
	await expect(link).toBeHidden();
});
