import type { Page } from "@playwright/test";
import { BACKGROUND_STATUS_KEY } from "../src/lib/background-status/settings";
import { E2E_MOCK_MODEL, E2E_MOCK_REPLY } from "../src/lib/chat/e2e-model";
import { MODEL_CHOICE_STORAGE_KEY } from "../src/lib/chat/model-selection";
import { expect, test } from "./support/fixtures";

// Roadmap 3.10: while the tab is hidden, its title and favicon follow replies, and replies that end
// send a notification (offered once, after the first reply the person leaves running). Playwright
// can't hide a tab, so the page gets a fake `document.hidden` and a fake `Notification` that record
// what the app does. Replies come from the AI SDK mock model on the real `/new` route.

const BASE_TITLE = "High Elo LLMs";
const replyText = E2E_MOCK_REPLY.join("");

interface FakeNotificationLog {
	permissionRequests: number;
	shown: { title: string; tag?: string }[];
}

declare global {
	interface Window {
		__fakeHidden: boolean;
		__grantNotifications: NotificationPermission;
		__titles: string[];
		__notificationLog: FakeNotificationLog;
		__clickNotification: (index: number) => void;
	}
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript(
		([key, model]) =>
			localStorage.setItem(key, JSON.stringify({ provider: "local", model })),
		[MODEL_CHOICE_STORAGE_KEY, E2E_MOCK_MODEL],
	);
	await page.addInitScript(() => {
		window.__fakeHidden = false;
		window.__grantNotifications = "granted";
		Object.defineProperty(document, "hidden", {
			configurable: true,
			get: () => window.__fakeHidden,
		});
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => (window.__fakeHidden ? "hidden" : "visible"),
		});

		// Every title the page shows, in order, so a short reply's "replying" title isn't missed.
		window.__titles = [];
		new MutationObserver(() => {
			if (window.__titles.at(-1) !== document.title) {
				window.__titles.push(document.title);
			}
		}).observe(document, {
			subtree: true,
			childList: true,
			characterData: true,
		});

		const log: FakeNotificationLog = { permissionRequests: 0, shown: [] };
		const instances: { onclick: (() => void) | null }[] = [];
		window.__notificationLog = log;
		window.__clickNotification = (index) => instances[index]?.onclick?.();
		class FakeNotification {
			static permission: NotificationPermission = "default";
			static async requestPermission() {
				log.permissionRequests += 1;
				FakeNotification.permission = window.__grantNotifications;
				return FakeNotification.permission;
			}
			onclick: (() => void) | null = null;
			constructor(title: string, options?: NotificationOptions) {
				log.shown.push({ title, tag: options?.tag });
				instances.push(this);
			}
			close() {}
		}
		Object.defineProperty(window, "Notification", {
			configurable: true,
			value: FakeNotification,
		});
	});
});

async function setHidden(page: Page, hidden: boolean) {
	await page.evaluate((value) => {
		window.__fakeHidden = value;
		document.dispatchEvent(new Event("visibilitychange"));
	}, hidden);
}

const notificationLog = (page: Page) =>
	page.evaluate(() => window.__notificationLog);
const favicon = (page: Page) =>
	page.locator('link[rel~="icon"]').getAttribute("href");

/** Sends a message; with `hidden`, the reply runs while the tab is hidden. */
async function send(page: Page, text: string, hidden = false) {
	const replies = page.getByText(replyText);
	// Wait for a new reply, not one already on the page.
	const before = await replies.count();
	const box = page.getByPlaceholder("Ask anything");
	await box.fill(text);
	if (hidden) await setHidden(page, true);
	await box.press("Enter");
	await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);
	await expect(replies).toHaveCount(before + 1);
	await expect(page.locator("[data-chat-status]")).toHaveAttribute(
		"data-chat-status",
		"ready",
	);
}

const offer = (page: Page) =>
	page.getByRole("region", { name: "Get notified when a reply is ready?" });

test("the tab title and icon follow a reply while hidden, and reset when shown", async ({
	page,
}) => {
	await page.goto("/new");
	await expect(page).toHaveTitle(BASE_TITLE);

	await send(page, "Plan a trip", true);
	await expect(page).toHaveTitle(`✓ Done — ${BASE_TITLE}`);
	const titles = await page.evaluate(() => window.__titles);
	expect(titles).toContain(`● Replying — ${BASE_TITLE}`);
	expect(await favicon(page)).toMatch(/^data:image\/svg\+xml,/);

	await setHidden(page, false);
	await expect(page).toHaveTitle(BASE_TITLE);
	expect(await favicon(page)).toBe("/favicon.ico");
});

test("notifications are offered only after the first reply left running, then name the chat", async ({
	page,
}) => {
	await page.goto("/new");
	// A visible reply asks for nothing.
	await send(page, "Trip to Lisbon");
	await setHidden(page, true);
	await setHidden(page, false);
	await expect(offer(page)).toHaveCount(0);
	expect((await notificationLog(page)).permissionRequests).toBe(0);

	// Leaving a reply running brings our explainer when the person comes back, before any browser prompt.
	await send(page, "And a day in Porto?", true);
	expect((await notificationLog(page)).permissionRequests).toBe(0);
	await setHidden(page, false);
	await expect(offer(page)).toBeVisible();
	expect((await notificationLog(page)).permissionRequests).toBe(0);
	await offer(page)
		.getByRole("button", { name: "Turn on notifications" })
		.click();
	await expect(offer(page)).toHaveCount(0);
	expect((await notificationLog(page)).permissionRequests).toBe(1);

	// The next reply that ends in the background notifies, with the chat's title only.
	const chatUrl = page.url();
	await send(page, "What about food?", true);
	await expect
		.poll(async () => (await notificationLog(page)).shown)
		.toEqual([
			{ title: "Reply ready in Trip to Lisbon", tag: expect.any(String) },
		]);
	await setHidden(page, false);

	// Clicking it opens that chat.
	await page.getByRole("link", { name: "New chat" }).click();
	await expect(page).toHaveURL(/\/new$/);
	await page.evaluate(() => window.__clickNotification(0));
	await expect(page).toHaveURL(chatUrl);

	// Offered once: after a reload, leaving a reply running doesn't offer again.
	await page.reload();
	await expect(page.getByText(replyText)).toHaveCount(3);
	await send(page, "One more", true);
	await setHidden(page, false);
	await expect(offer(page)).toHaveCount(0);
});

test("a denied prompt is handled without asking again", async ({ page }) => {
	await page.addInitScript(() => {
		window.__grantNotifications = "denied";
	});
	await page.goto("/new");
	await send(page, "Hello", true);
	await setHidden(page, false);
	await offer(page)
		.getByRole("button", { name: "Turn on notifications" })
		.click();
	const blocked = page.getByRole("region", {
		name: "Notifications are blocked",
	});
	await expect(blocked).toBeVisible();
	await blocked.getByRole("button", { name: "OK" }).click();
	await expect(blocked).toHaveCount(0);

	await send(page, "Again", true);
	expect((await notificationLog(page)).shown).toEqual([]);
	await setHidden(page, false);
	await expect(offer(page)).toHaveCount(0);
	expect((await notificationLog(page)).permissionRequests).toBe(1);
});

test("settings switch tab status and each notification on and off", async ({
	page,
}) => {
	await page.goto("/settings");
	const section = page.getByRole("region", { name: "Background status" });
	const tabStatus = section.getByRole("switch", {
		name: "Show reply status in the tab title",
	});
	const finished = section.getByRole("switch", {
		name: "Notify me when a reply is ready",
	});
	const failed = section.getByRole("switch", {
		name: "Notify me when a reply fails",
	});
	for (const toggle of [tabStatus, finished, failed]) {
		await expect(toggle).toBeChecked();
	}
	// The keys list above loads after the page; wait so the switches stop moving before clicking.
	await expect(page.getByText("Loading saved keys…")).toHaveCount(0);

	await tabStatus.click();
	await failed.click();
	await expect(tabStatus).not.toBeChecked();
	await expect(failed).not.toBeChecked();
	expect(
		await page.evaluate(
			(key) => JSON.parse(localStorage.getItem(key) ?? "{}"),
			BACKGROUND_STATUS_KEY,
		),
	).toMatchObject({
		tabStatus: false,
		notifyFinished: true,
		notifyFailed: false,
	});

	// The browser prompt from Settings, without waiting for a reply.
	await section.getByRole("button", { name: "Allow notifications" }).click();
	await expect(
		section.getByText("Notifications are allowed in this browser."),
	).toBeVisible();
	expect((await notificationLog(page)).permissionRequests).toBe(1);

	await page.reload();
	await expect(tabStatus).not.toBeChecked();
	await expect(finished).toBeChecked();
	await expect(failed).not.toBeChecked();

	// With tab status off, a hidden reply leaves the title alone.
	await page.getByRole("link", { name: "New chat" }).click();
	await send(page, "Quiet please", true);
	await setHidden(page, false);
	expect(await page.evaluate(() => window.__titles)).not.toContain(
		`● Replying — ${BASE_TITLE}`,
	);
	await expect(page).toHaveTitle(BASE_TITLE);
});
