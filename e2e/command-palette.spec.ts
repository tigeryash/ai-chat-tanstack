import type { Page, Request } from "@playwright/test";
import { E2E_MOCK_MODEL, E2E_MOCK_REPLY } from "../src/lib/chat/e2e-model";
import { MODEL_CHOICE_STORAGE_KEY } from "../src/lib/chat/model-selection";
import { RECENT_COMMANDS_KEY } from "../src/lib/commands/recent";
import { expect, test } from "./support/fixtures";
import { settingsDialog } from "./support/settings";

// Roadmap R2 S5: the command palette. Cmd+K (Ctrl+K off a Mac) opens it, even from the composer; it
// finds chats (only the viewer's), settings and actions, runs them, and remembers fixed commands as
// recent. Chats come from the AI SDK mock model on the real `/new` route.

test.beforeEach(async ({ page }) => {
	await page.addInitScript(
		([key, model]) =>
			localStorage.setItem(key, JSON.stringify({ provider: "local", model })),
		[MODEL_CHOICE_STORAGE_KEY, E2E_MOCK_MODEL],
	);
});

const composer = (page: Page) => page.getByPlaceholder("Ask anything");
const palette = (page: Page) =>
	page.getByRole("dialog", { name: "Command palette" });
const search = (page: Page) =>
	palette(page).getByRole("combobox", {
		name: "Search commands, chats and settings",
	});
const results = (page: Page) =>
	palette(page).getByRole("listbox", { name: "Results" });
const option = (page: Page, name: string | RegExp) =>
	results(page).getByRole("option", { name });

async function openPalette(page: Page) {
	await page.keyboard.press("ControlOrMeta+K");
	await expect(search(page)).toBeFocused();
}

/** Starts a chat from `/new` and waits for its reply to be saved. Returns its path. */
async function chat(page: Page, text: string): Promise<string> {
	await page.goto("/new");
	await composer(page).fill(text);
	await composer(page).press("Enter");
	await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);
	await expect(page.getByText(E2E_MOCK_REPLY.join(""))).toBeVisible();
	await expect(page.locator("[data-chat-status]")).toHaveAttribute(
		"data-chat-status",
		"ready",
	);
	await expect(page.getByRole("link", { name: text })).toBeVisible();
	return new URL(page.url()).pathname;
}

/** Gives a stored chat to another account, as if someone else had made it in this browser. */
async function giveToAnotherAccount(page: Page, chatId: string) {
	await page.evaluate(async (id) => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const open = indexedDB.open("highelo-chats");
			open.onsuccess = () => resolve(open.result);
			open.onerror = () => reject(open.error);
		});
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction("chats", "readwrite");
			const store = tx.objectStore("chats");
			const get = store.get(id);
			get.onsuccess = () =>
				store.put({ ...get.result, ownerId: "someone-else" });
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
	}, chatId);
}

test("Cmd+K opens from the composer, and Esc returns focus and the cursor there", async ({
	page,
}) => {
	await page.goto("/new");
	await composer(page).fill("hello world");
	await composer(page).evaluate((box: HTMLTextAreaElement) =>
		box.setSelectionRange(5, 5),
	);

	await openPalette(page);
	await expect(palette(page)).toBeVisible();
	await expect(search(page)).toHaveAttribute("aria-expanded", "true");
	// Focus stays in the palette.
	for (const key of ["Tab", "Tab", "Shift+Tab", "Tab"]) {
		await page.keyboard.press(key);
	}
	expect(
		await palette(page).evaluate((dialog) =>
			dialog.contains(document.activeElement),
		),
	).toBe(true);

	await page.keyboard.press("Escape");
	await expect(palette(page)).toHaveCount(0);
	await expect(composer(page)).toBeFocused();
	await expect(composer(page)).toHaveValue("hello world");
	expect(
		await composer(page).evaluate((box: HTMLTextAreaElement) => [
			box.selectionStart,
			box.selectionEnd,
		]),
	).toEqual([5, 5]);

	// Cmd+K again closes it.
	await openPalette(page);
	await page.keyboard.press("ControlOrMeta+K");
	await expect(palette(page)).toHaveCount(0);
	await expect(composer(page)).toBeFocused();
});

test("finds a chat and a setting, and makes no request doing it", async ({
	page,
}) => {
	const path = await chat(page, "Garden planting plan");
	await page.goto("/new");
	await expect(composer(page)).toBeVisible();

	const requests: string[] = [];
	const record = (request: Request) => {
		const url = new URL(request.url());
		// Its own code loads on first open; anything else would be a request.
		if (!url.pathname.startsWith("/assets/")) requests.push(request.url());
	};
	page.on("request", record);

	await openPalette(page);
	await search(page).fill("#garden");
	await expect(option(page, /Garden planting plan/)).toHaveAttribute(
		"aria-selected",
		"true",
	);
	await page.keyboard.press("Enter");
	await expect(page).toHaveURL(new RegExp(`${path}$`));
	await expect(palette(page)).toHaveCount(0);

	await openPalette(page);
	await search(page).fill("ollama");
	await expect(results(page).getByRole("option")).toHaveCount(1);
	await expect(option(page, /Local models/)).toContainText(
		"Settings / Connections",
	);
	await page.keyboard.press("Enter");
	await expect(settingsDialog(page)).toBeVisible();
	const row = page.locator("#setting-local-endpoints");
	await expect(row).toBeFocused();
	await expect(row).toHaveAttribute("data-highlighted", "true");
	await expect(page).toHaveURL(/\?settings=connections$/);

	page.off("request", record);
	expect(requests).toEqual([]);
});

test("never lists another account's chat", async ({ page }) => {
	const mine = await chat(page, "My travel notes");
	const theirs = await chat(page, "Their travel secrets");
	await giveToAnotherAccount(page, theirs.slice(1));
	await page.goto(mine);
	await expect(
		page.getByRole("link", { name: "My travel notes" }),
	).toBeVisible();

	await openPalette(page);
	await search(page).fill("travel");
	await expect(option(page, /My travel notes/)).toBeVisible();
	await expect(results(page)).not.toContainText("Their travel secrets");
	await search(page).fill("#");
	await expect(results(page).getByRole("option")).toHaveCount(1);
	await search(page).fill("secrets");
	await expect(palette(page).getByRole("status")).toHaveText(
		"Nothing matches “secrets”.",
	);
});

test("prefixes keep one group, toggles flip in place, and recent commands come first", async ({
	page,
}) => {
	await page.goto("/new");
	await expect(composer(page)).toBeVisible();
	await openPalette(page);

	await search(page).fill(">");
	await expect(
		results(page).getByRole("group", { name: "Actions" }),
	).toBeVisible();
	await expect(results(page).getByRole("group")).toHaveCount(1);
	await search(page).fill("/theme");
	await expect(results(page).getByRole("group")).toHaveCount(1);
	await expect(
		results(page).getByRole("group", { name: "Settings" }),
	).toBeVisible();

	// A toggle runs without closing the palette.
	await search(page).fill("theme dark");
	const dark = option(page, "Theme: Dark");
	await expect(dark).toHaveAttribute("aria-checked", "false");
	await dark.click();
	await expect(page.locator("html")).toHaveClass("dark");
	await expect(dark).toHaveAttribute("aria-checked", "true");
	await expect(search(page)).toBeFocused();

	await search(page).fill("open settings");
	await page.keyboard.press("Enter");
	await expect(settingsDialog(page)).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(settingsDialog(page)).toHaveCount(0);

	await openPalette(page);
	const recent = results(page).getByRole("group", { name: "Recent" });
	await expect(recent.getByRole("option")).toHaveText([
		/Open Settings/,
		/Theme: Dark/,
	]);
	expect(
		await page.evaluate(
			(key) => JSON.parse(localStorage.getItem(key) ?? "[]"),
			RECENT_COMMANDS_KEY,
		),
	).toEqual(["open-settings", "theme-dark"]);
});

test("analytics get only fixed ids, never the query or a chat's title", async ({
	page,
}) => {
	await chat(page, "Private budget talk");
	await openPalette(page);
	await search(page).fill("private budget");
	await page.keyboard.press("Enter");
	await expect(palette(page)).toHaveCount(0);

	const events = await page.evaluate(() =>
		(window.__highEloAnalytics ?? []).filter((event) =>
			["palette_opened", "command_run"].includes(event.name),
		),
	);
	expect(events).toEqual([
		{ name: "palette_opened", properties: {} },
		{ name: "command_run", properties: { id: "chat.open" } },
	]);
	// Nothing about the chat went into recency either.
	expect(
		await page.evaluate(
			(key) => localStorage.getItem(key),
			RECENT_COMMANDS_KEY,
		),
	).toBeNull();
});

test("the sidebar's button opens it and gets focus back", async ({ page }) => {
	await page.goto("/new");
	const button = page.getByRole("button", { name: "Command palette" });
	await button.click();
	await expect(search(page)).toBeFocused();
	await search(page).fill("prompts");
	await page.keyboard.press("Enter");
	await expect(page).toHaveURL(/\/prompts$/);
	await expect(button).toBeFocused();
});

test.describe("on a phone", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("opens from the sidebar sheet and fits the screen", async ({ page }) => {
		await page.goto("/new");
		await page.getByRole("button", { name: "Toggle sidebar" }).click();
		await page.getByRole("button", { name: "Command palette" }).click();
		await expect(search(page)).toBeFocused();
		const box = await palette(page).boundingBox();
		expect(box?.width).toBeLessThanOrEqual(390);
		expect(box?.x).toBeGreaterThanOrEqual(0);
		await search(page).fill("new chat");
		await expect(option(page, "New chat")).toBeVisible();
	});
});
