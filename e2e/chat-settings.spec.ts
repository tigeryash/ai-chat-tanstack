import type { Page } from "@playwright/test";
import { e2eMockModel, e2eMockReply } from "../src/lib/chat/e2e-model";
import { MOCK_REASONING, MOCK_REPLY } from "../src/routes/e2e/-mock-chat";
import { expect, test } from "./support/fixtures";
import { settingsDialog } from "./support/settings";
import { openWorkspace, pane, panes, setUp } from "./support/workspaces";

// Roadmap R2 S10: Settings → Chat. Reply stats (in the "⋯" menu, or cost or all beside the reply), how
// reasoning starts (closed by default), and
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

/**
 * Resolves once the "Thinking..." line is on screen with none of the answer yet, checked every frame:
 * the mock reasons for about 200 ms, which expect's polls can step over.
 */
function thinkingShows(page: Page) {
	return page.waitForFunction(
		(answer) =>
			[...document.querySelectorAll("main *")].some(
				(element) =>
					element.childElementCount === 0 &&
					element.textContent === "Thinking..." &&
					element.getClientRects().length > 0,
			) && !document.querySelector("main")?.textContent?.includes(answer),
		"word1",
		{ polling: "raf" },
	);
}

/** A new mock chat (/e2e/chat) with one finished reply; resolves once "Thinking..." showed and it ended. */
async function replyOnce(page: Page) {
	await page.goto("/e2e/chat");
	await expect(page.locator("main[data-chat-id]")).toBeAttached();
	const thinking = thinkingShows(page);
	const box = page.getByPlaceholder("Ask anything");
	await box.fill("Hello mock");
	await box.press("Enter");
	await thinking;
	await expect(page.getByText(replyText)).toBeVisible();
	await expect(status(page)).toHaveAttribute("data-chat-status", "ready");
}

/** Records, from each page load's first paint, whether a reasoning panel was ever open. */
async function watchReasoning(page: Page) {
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
	return () =>
		page.evaluate(
			() =>
				(window as unknown as { __reasoning: { opened: boolean } }).__reasoning
					.opened,
		);
}

const thoughtFor = (page: Page) =>
	page.getByRole("button", { name: /Thought for/ });

test("the defaults: stats only in the ⋯ menu, reasoning closed, panes synced, sync scroll off", async ({
	page,
	context,
}) => {
	const everOpened = await watchReasoning(page);
	const dialog = await openChatSettings(page);
	await expect(
		dialog.getByRole("radiogroup", { name: "Reply stats" }),
	).toBeVisible();
	await expect(
		dialog.getByRole("radio", { name: "In the ⋯ menu" }),
	).toBeChecked();
	await expect(dialog.getByRole("radio", { name: "Closed" })).toBeChecked();
	await expect(
		dialog.getByRole("switch", { name: "Sync scroll on by default" }),
	).not.toBeChecked();
	await expect(
		dialog.getByRole("switch", { name: "New panes start synced" }),
	).toBeChecked();
	await closeSettings(page);

	// "Thinking..." shows while it streams (replyOnce waits for it), but the reasoning never opens.
	await replyOnce(page);
	await expect(inlineStats(page)).toHaveCount(0);
	await expect(thoughtFor(page)).toHaveAttribute("aria-expanded", "false");
	await expect(page.getByText(reasoningText)).toHaveCount(0);
	expect(await everOpened()).toBe(false);
	// Still opens on request, and the stats are in the ⋯ menu.
	await thoughtFor(page).click();
	await expect(page.getByText(reasoningText)).toBeVisible();
	await page.getByRole("button", { name: "Reply details" }).click();
	await expect(page.locator("[data-usage='reply']")).toContainText("Tokens8");
	await page.keyboard.press("Escape");

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

test("reply stats can show the cost, or cost, tokens and timings, beside the reply", async ({
	page,
}) => {
	const dialog = await openChatSettings(page);
	await dialog.getByRole("radio", { name: "All beside the reply" }).click();
	await closeSettings(page);

	await replyOnce(page);
	// The mock model reports 3 + 5 tokens and has no price.
	await expect(inlineStats(page)).toHaveText(
		/^8 tokens · \d+(\.\d)? (ms|s) · \d+ tok\/s$/,
	);

	// A priced fixture reply: cost only, and an estimate is marked.
	await page.goto("/new?settings=chat");
	await settingsDialog(page)
		.getByRole("radio", { name: "Cost beside the reply" })
		.click();
	await closeSettings(page);
	await page.goto("/e2e/usage");
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();
	await expect(inlineStats(page)).toHaveText(["$0.0042", "~$0.0011"]);
});

test("reasoning can open while thinking, or stay open", async ({ page }) => {
	const everOpened = await watchReasoning(page);
	let dialog = await openChatSettings(page);
	await dialog.getByRole("radio", { name: "Open while thinking" }).click();
	await closeSettings(page);

	// Open while it streamed, closed once it's done.
	await replyOnce(page);
	expect(await everOpened()).toBe(true);
	await expect(thoughtFor(page)).toHaveAttribute("aria-expanded", "false");

	dialog = await openChatSettings(page);
	await dialog.getByRole("radio", { name: "Always open" }).click();
	await closeSettings(page);

	await replyOnce(page);
	// Past the auto-close delay, it's still open.
	await page.waitForTimeout(1500);
	await expect(thoughtFor(page)).toHaveAttribute("aria-expanded", "true");
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
