import type { Page } from "@playwright/test";
import { e2eMockModel, e2eMockReply } from "../src/lib/chat/e2e-model";
import { MOCK_REASONING, MOCK_REPLY } from "../src/routes/e2e/-mock-chat";
import { expect, test } from "./support/fixtures";
import { settingsDialog } from "./support/settings";
import { openWorkspace, pane, panes, setUp } from "./support/workspaces";

// Roadmap R2 S10: Settings → Chat. Stats under each reply (none, cost, all), how reasoning starts, and
// the Sync scroll and "new panes start synced" defaults for workspaces. Each is set in the dialog,
// then checked on a new chat. Replies come from the AI SDK mock model (hard rule 6).

const reasoningText = MOCK_REASONING.join("");
const replyText = MOCK_REPLY.join("").trim();
const inlineStats = (page: Page) => page.locator("[data-inline-stats]");
const status = (page: Page) => page.locator("[data-chat-status]");

/** Opens Settings → Chat and leaves it open. */
async function openChatSettings(page: Page) {
	await page.goto("/new?settings=chat");
	const dialog = settingsDialog(page);
	await expect(
		dialog.getByRole("switch", { name: "New panes start synced" }),
	).toBeVisible();
	return dialog;
}

async function closeSettings(page: Page) {
	await page.keyboard.press("Escape");
	await expect(settingsDialog(page)).toHaveCount(0);
}

/** A new mock chat (/e2e/chat) with one finished reply. */
async function replyOnce(page: Page) {
	await page.goto("/e2e/chat");
	await expect(page.locator("main[data-chat-id]")).toBeAttached();
	const box = page.getByPlaceholder("Ask anything");
	await box.fill("Hello mock");
	await box.press("Enter");
	await expect(page.getByText(replyText)).toBeVisible();
	await expect(status(page)).toHaveAttribute("data-chat-status", "ready");
}

test("the defaults: no stats under a reply, reasoning open only while thinking, panes synced, sync scroll off", async ({
	page,
	context,
}) => {
	const dialog = await openChatSettings(page);
	await expect(
		dialog.getByRole("radiogroup", { name: "Stats under each reply" }),
	).toBeVisible();
	await expect(dialog.getByRole("radio", { name: "None" })).toBeChecked();
	await expect(
		dialog.getByRole("radio", { name: "Open while thinking" }),
	).toBeChecked();
	await expect(
		dialog.getByRole("switch", { name: "Sync scroll on by default" }),
	).not.toBeChecked();
	await expect(
		dialog.getByRole("switch", { name: "New panes start synced" }),
	).toBeChecked();
	await closeSettings(page);

	await replyOnce(page);
	await expect(inlineStats(page)).toHaveCount(0);
	// Opened while it streamed, closed again once done.
	await expect(
		page.getByRole("button", { name: /Thought for/ }),
	).toHaveAttribute("aria-expanded", "false");

	await setUp(context, page, e2eMockModel("alpha"));
	await openWorkspace(page, 3);
	for (const n of [1, 2, 3]) {
		await expect(
			pane(page, n).getByRole("switch", { name: `Sync Pane ${n}` }),
		).toBeChecked();
	}
	await expect(
		page.getByRole("switch", { name: "Sync scroll" }),
	).not.toBeChecked();
});

test("stats under each reply show the cost, or cost, tokens and timings", async ({
	page,
}) => {
	const dialog = await openChatSettings(page);
	await dialog.getByRole("radio", { name: "All" }).click();
	await closeSettings(page);

	await replyOnce(page);
	// The mock model reports 3 + 5 tokens and has no price.
	await expect(inlineStats(page)).toHaveText(
		/^8 tokens · \d+(\.\d)? (ms|s) · \d+ tok\/s$/,
	);

	// A priced fixture reply: "Cost" keeps only its cost, and an estimate is marked.
	await page.goto("/new?settings=chat");
	await settingsDialog(page).getByRole("radio", { name: "Cost" }).click();
	await closeSettings(page);
	await page.goto("/e2e/usage");
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();
	await expect(inlineStats(page)).toHaveText(["$0.0042", "~$0.0011"]);
});

test("reasoning can start closed, or stay open", async ({ page }) => {
	// Records whether a reasoning panel was ever open on a page load, from the first paint.
	await page.addInitScript(() => {
		const seen = { opened: false };
		Object.assign(window, { __reasoning: seen });
		new MutationObserver(() => {
			if (
				document.querySelector(
					"[data-slot='trace-collapsible-trigger'][aria-expanded='true']",
				)
			) {
				seen.opened = true;
			}
		}).observe(document, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ["aria-expanded"],
		});
	});
	const everOpened = () =>
		page.evaluate(
			() =>
				(window as unknown as { __reasoning: { opened: boolean } }).__reasoning
					.opened,
		);
	let dialog = await openChatSettings(page);
	await dialog.getByRole("radio", { name: "Closed" }).click();
	await closeSettings(page);

	await replyOnce(page);
	const trigger = page.getByRole("button", { name: /Thought for/ });
	await expect(trigger).toHaveAttribute("aria-expanded", "false");
	await expect(page.getByText(reasoningText)).toHaveCount(0);
	// Not even while it streamed.
	expect(await everOpened()).toBe(false);

	dialog = await openChatSettings(page);
	await dialog.getByRole("radio", { name: "Always open" }).click();
	await closeSettings(page);

	await replyOnce(page);
	// Past the auto-close delay, it's still open.
	await page.waitForTimeout(1500);
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	await expect(page.getByText(reasoningText)).toBeVisible();
});

test("workspaces can open with sync scroll on, and new panes unsynced", async ({
	page,
	context,
}) => {
	await setUp(context, page, e2eMockModel("alpha"));
	const dialog = await openChatSettings(page);
	await dialog
		.getByRole("switch", { name: "Sync scroll on by default" })
		.click();
	await dialog.getByRole("switch", { name: "New panes start synced" }).click();
	await closeSettings(page);

	await openWorkspace(page, 3);
	await expect(panes(page)).toHaveCount(3);
	for (const n of [1, 2, 3]) {
		await expect(
			pane(page, n).getByRole("switch", { name: `Sync Pane ${n}` }),
		).not.toBeChecked();
	}
	await expect(page.getByRole("switch", { name: "Sync scroll" })).toBeChecked();

	// Unsynced panes send on their own.
	const box = pane(page, 1).getByPlaceholder("Ask anything");
	await box.fill("Only here");
	await box.press("Enter");
	await expect(pane(page, 1).getByText(e2eMockReply("alpha"))).toBeVisible();
	await expect(pane(page, 2).getByText("Only here")).toHaveCount(0);
});
