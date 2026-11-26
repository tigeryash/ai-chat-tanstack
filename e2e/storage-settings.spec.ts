import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { PNG } from "./support/openrouter";
import { settingsDialog } from "./support/settings";

// Refine S11: Settings → Your data shows what's stored on this device for a fixture chat, and the
// Danger zone deletes every chat, but only after its confirm dialog.

const message = (id: string, role: "user" | "assistant", text: string) => ({
	id,
	role,
	parts: [{ type: "text", text, state: "done" }],
});

const chat = (id: string, title: string, firstMessage: object) => ({
	formatVersion: 2,
	id,
	title,
	createdAt: 1_792_900_000_000,
	updatedAt: 1_792_900_042_000,
	ownerId: null,
	messages: [firstMessage, message(`${id}-r`, "assistant", "Done.")],
});

const FIXTURE = JSON.stringify({
	format: "highelo-chats",
	exportVersion: 2,
	exportedAt: "2026-11-16T00:00:00.000Z",
	chats: [
		chat("fixture-image", "Fixture with an image", {
			id: "fixture-image-u",
			role: "user",
			parts: [
				{
					type: "file",
					mediaType: "image/png",
					filename: "red.png",
					url: `data:image/png;base64,${PNG.toString("base64")}`,
				},
				{ type: "text", text: "What is this?" },
			],
		}),
		chat("fixture-text", "Fixture in words", message("t-u", "user", "Hello")),
	],
});

async function importFixture(page: Page) {
	await page.goto("/new?settings=data");
	await settingsDialog(page)
		.getByLabel("Export file to import")
		.setInputFiles({
			name: "fixture.json",
			mimeType: "application/json",
			buffer: Buffer.from(FIXTURE),
		});
	await expect(
		settingsDialog(page)
			.getByRole("status")
			.filter({ hasText: "Chats: 2 added" }),
	).toBeVisible();
}

test("Your data shows the chats and files stored here, and the browser's estimate", async ({
	page,
}) => {
	await importFixture(page);
	const used = page.getByTestId("storage-used");
	await expect(used).toContainText("2 chats and 1 attached file");
	await expect(used).toContainText("used by this site in this browser");
	await expect(page.getByTestId("persistence-state")).toHaveText(
		/^(On|Off|This browser)/,
	);
});

test("Delete all chats asks first, and Cancel keeps them", async ({ page }) => {
	await importFixture(page);
	const dialog = settingsDialog(page);
	await dialog.getByRole("button", { name: "Delete all chats" }).click();
	const confirm = page.getByRole("alertdialog", {
		name: "Delete all chats on this device?",
	});
	await expect(confirm).toBeVisible();
	await confirm.getByRole("button", { name: "Cancel" }).click();
	await expect(confirm).toBeHidden();
	await expect(page.getByTestId("storage-used")).toContainText("2 chats");
});

test("Delete all chats deletes every chat and its files from this browser", async ({
	page,
}) => {
	await importFixture(page);
	await page.goto("/fixture-image?settings=data");
	const dialog = settingsDialog(page);
	await dialog.getByRole("button", { name: "Delete all chats" }).click();
	await page
		.getByRole("alertdialog", { name: "Delete all chats on this device?" })
		.getByRole("button", { name: "Delete all chats" })
		.click();
	await expect(
		dialog.getByRole("status").filter({ hasText: "Deleted 2 chats" }),
	).toHaveText("Deleted 2 chats from this browser.");
	await expect(page.getByTestId("storage-used")).toContainText(
		"0 chats and 0 attached files",
	);
	// It left the deleted chat's page, and nothing comes back after a reload.
	await expect(page).toHaveURL(/\/new\?settings=data$/);
	await page.reload();
	await expect(page.getByTestId("storage-used")).toContainText("0 chats");
	await page.keyboard.press("Escape");
	await expect(
		page.getByRole("link", { name: "Fixture in words" }),
	).toHaveCount(0);
});
