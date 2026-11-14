import type { Page } from "@playwright/test";
import { CONTEXT_FIXTURE_CHATS } from "../src/lib/chat/context-usage.fixtures";
import { expect, test } from "./support/fixtures";
import { settingsDialog } from "./support/settings";

// Roadmap R2 S4: a context ring in the chat header, and a closable notice under it once the chat nears
// (80%) or passes its context length, with a switch for the notice in Settings → Chat. Three saved chats
// on DeepSeek V4.1 Flash (128K) at about 41%, 85% and 110% are imported through Settings → Your data.

type Level = keyof typeof CONTEXT_FIXTURE_CHATS;
const chatId = (level: Level) => `context-${level}`;

const EXPORT = {
	format: "highelo-chats",
	exportVersion: 2,
	exportedAt: "2026-11-12T00:00:00.000Z",
	chats: (Object.keys(CONTEXT_FIXTURE_CHATS) as Level[]).map((level) => ({
		formatVersion: 3,
		id: chatId(level),
		title: `Context ${level}`,
		createdAt: 1_762_900_000_000,
		updatedAt: 1_762_900_000_000,
		ownerId: null,
		messages: CONTEXT_FIXTURE_CHATS[level],
	})),
};

const ring = (page: Page) => page.locator("[data-context-ring]");
const notice = (page: Page) => page.locator("[data-context-warning]");

async function openChat(page: Page, level: Level) {
	await page.goto(`/${chatId(level)}`);
	await expect(page.getByText("A long answer")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
	await page.goto("/new?settings=data");
	const data = page.getByRole("region", { name: "Your data" });
	await data.getByLabel("Export file to import").setInputFiles({
		name: "chats.json",
		mimeType: "application/json",
		buffer: Buffer.from(JSON.stringify(EXPORT)),
	});
	await expect(data.getByRole("status")).toContainText("Chats: 3 added");
});

test("the ring shows how much context is used, muted under 80% and in the warning colour from there", async ({
	page,
}) => {
	await openChat(page, "under");
	await expect(ring(page)).toHaveAccessibleName("41% of 128K context used");
	await expect(ring(page)).toHaveAttribute("data-context-ring", "under");
	const muted = await ring(page).evaluate((el) => getComputedStyle(el).color);
	await ring(page).hover();
	await expect(page.locator("[data-slot='tooltip-content']")).toHaveText(
		"41% of 128K context used",
	);
	await expect(notice(page)).toHaveCount(0);

	await openChat(page, "nearing");
	await expect(ring(page)).toHaveAccessibleName("85% of 128K context used");
	await expect(ring(page)).toHaveAttribute("data-context-ring", "nearing");
	expect(
		await ring(page).evaluate((el) => getComputedStyle(el).color),
	).not.toBe(muted);

	await openChat(page, "over");
	await expect(ring(page)).toHaveAccessibleName("110% of 128K context used");
	await expect(ring(page)).toHaveAttribute("data-context-ring", "over");
});

test("a chat near or past its context gets a notice with what to do", async ({
	page,
}) => {
	await openChat(page, "nearing");
	await expect(notice(page)).toHaveText(
		"This chat has used 85% of its 128K context. Start a new chat, or pick a model with more context.",
	);
	await openChat(page, "over");
	await expect(notice(page)).toHaveText(
		"This chat is past its 128K context, so replies may fail or forget the start. Start a new chat, or pick a model with more context.",
	);
});

test("closing a notice hides it for that chat only, also after a reload", async ({
	page,
}) => {
	await openChat(page, "nearing");
	await notice(page)
		.getByRole("button", { name: "Close context notice" })
		.click();
	await expect(notice(page)).toHaveCount(0);
	await expect(ring(page)).toBeVisible();

	await page.reload();
	await expect(page.getByText("A long answer")).toBeVisible();
	await expect(ring(page)).toBeVisible();
	await expect(notice(page)).toHaveCount(0);

	await openChat(page, "over");
	await expect(notice(page)).toBeVisible();
});

test("the switch in Settings → Chat turns the notice off, not the ring, and it stays off", async ({
	page,
}) => {
	await page.goto(`/${chatId("over")}?settings=chat`);
	const dialog = settingsDialog(page);
	const toggle = dialog.getByRole("switch", { name: "Context-length notices" });
	await expect(toggle).toBeChecked();
	await toggle.click();
	await expect(toggle).not.toBeChecked();
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await expect(notice(page)).toHaveCount(0);
	await expect(ring(page)).toBeVisible();

	await page.reload();
	await expect(page.getByText("A long answer")).toBeVisible();
	await expect(notice(page)).toHaveCount(0);
	await expect(ring(page)).toBeVisible();
});
