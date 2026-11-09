import type { Page } from "@playwright/test";
import { MOCK_REPLY } from "../src/routes/e2e/-mock-chat";
import { expect, test } from "./support/fixtures";

// Roadmap 1.7: edit a user message → a new branch with its own reply; switch back to the original;
// both survive a reload. On /e2e/chat (real transport and chat store, the mock model).

const replyText = MOCK_REPLY.join("").trim();

const status = (page: Page) => page.locator("[data-chat-status]");
const replies = (page: Page) =>
	page.locator("[data-slot='message']").filter({ hasText: "word1" });
const versions = (page: Page) => page.locator("[data-slot='message-versions']");

async function open(page: Page, search = "") {
	await page.goto(`/e2e/chat${search}`);
	await expect(page.locator("main[data-chat-id]")).toBeAttached();
}

async function waitForReply(page: Page) {
	await expect(status(page)).toHaveAttribute("data-chat-status", "ready", {
		timeout: 10_000,
	});
	await expect(replies(page)).toHaveCount(1);
	await expect(replies(page)).toContainText(replyText);
}

test("editing a message branches; switching back shows the original, after a reload too", async ({
	page,
}) => {
	// Two replies and two reloads: longer than most specs, so it gets more than the default 30 s.
	test.setTimeout(60_000);
	await open(page);
	const box = page.getByPlaceholder("Ask anything");
	await box.fill("Hello mock");
	await box.press("Enter");
	await waitForReply(page);
	await expect(versions(page)).toHaveCount(0);

	// Edit in place: the message becomes a box, the composer is untouched.
	await page.getByRole("button", { name: "Edit message" }).click();
	const editor = page.getByRole("textbox", { name: "Edit message" });
	await expect(editor).toHaveValue("Hello mock");
	// Escape cancels without sending.
	await editor.press("Escape");
	await expect(editor).toHaveCount(0);
	await page.getByRole("button", { name: "Edit message" }).click();
	await editor.fill("Edited mock");
	await editor.press("Enter");

	// A new reply streams for the edited message; the old one is out of view.
	await expect(status(page)).toHaveAttribute(
		"data-chat-status",
		/submitted|streaming/,
	);
	await waitForReply(page);
	await expect(page.getByText("Edited mock")).toBeVisible();
	await expect(page.getByText("Hello mock")).toHaveCount(0);
	await expect(versions(page)).toHaveText("2/2");

	await page.getByRole("button", { name: "Previous version" }).click();
	await expect(page.getByText("Hello mock")).toBeVisible();
	await expect(page.getByText("Edited mock")).toHaveCount(0);
	await expect(versions(page)).toHaveText("1/2");
	await expect(replies(page)).toContainText(replyText);
	await expect(
		page.getByRole("button", { name: "Previous version" }),
	).toBeDisabled();

	// The switch is saved: a fresh load shows the original, and can still go to the edit.
	const chatId = await page.locator("main").getAttribute("data-chat-id");
	await expect(async () => {
		await open(page, `?chat=${chatId}`);
		await expect(versions(page)).toHaveText("1/2", { timeout: 1_000 });
	}).toPass();
	await expect(page.getByText("Hello mock")).toBeVisible();
	await expect(replies(page)).toContainText(replyText);

	await page.getByRole("button", { name: "Next version" }).click();
	await expect(page.getByText("Edited mock")).toBeVisible();
	await expect(versions(page)).toHaveText("2/2");
	await expect(async () => {
		await open(page, `?chat=${chatId}`);
		await expect(versions(page)).toHaveText("2/2", { timeout: 1_000 });
	}).toPass();
	await expect(page.getByText("Edited mock")).toBeVisible();
	await expect(replies(page)).toHaveCount(1);
});
