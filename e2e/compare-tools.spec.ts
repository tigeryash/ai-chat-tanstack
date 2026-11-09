import type { Locator, Page } from "@playwright/test";
import { e2eMockModel, e2eMockReply } from "../src/lib/chat/e2e-model";
import { expect, test } from "./support/fixtures";
import {
	composer,
	openWorkspace,
	pane,
	pickModel,
	setUp,
	status,
} from "./support/workspaces";

// Roadmap 3.4: each pane's TTFT, tokens/sec and cost, thumbs up/down that survive a reload, sync
// scroll, and "Copy settings to all panes". Replies come from the e2e mock models (hard rule 6).

/** Two panes on alpha and beta, after one synced send. */
async function comparedOnce(page: Page, text = "Compare these") {
	await openWorkspace(page, 2);
	await pickModel(pane(page, 2), page, e2eMockModel("beta"));
	await composer(pane(page, 1)).fill(text);
	await composer(pane(page, 1)).press("Enter");
	for (const [n, name] of [
		[1, "alpha"],
		[2, "beta"],
	] as const) {
		await expect(pane(page, n).getByText(e2eMockReply(name))).toBeVisible();
		await expect(status(pane(page, n))).toHaveAttribute(
			"data-chat-status",
			"ready",
		);
	}
}

const scroller = (scope: Locator) =>
	scope.locator("[data-slot='message-scroller-viewport']");

const scrollTo = (scope: Locator, where: "top" | "bottom") =>
	scroller(scope).evaluate((el, to) => {
		el.scrollTop = to === "top" ? 0 : el.scrollHeight;
	}, where);

/** 0 at the top, 1 at the bottom. */
const ratioOf = (scope: Locator) =>
	scroller(scope).evaluate((el) =>
		el.scrollHeight <= el.clientHeight
			? 0
			: el.scrollTop / (el.scrollHeight - el.clientHeight),
	);

test("each pane shows its latest reply's timing, and a vote survives a reload", async ({
	page,
	context,
}) => {
	await setUp(context, page, e2eMockModel("alpha"));
	await comparedOnce(page);
	for (const n of [1, 2]) {
		await expect(pane(page, n).locator("[data-pane-stats]")).toContainText(
			/TTFT \d/,
		);
	}

	const good = (n: number) =>
		pane(page, n).getByRole("button", { name: "Good response" });
	const bad = (n: number) =>
		pane(page, n).getByRole("button", { name: "Bad response" });
	await good(1).click();
	await bad(2).click();
	await expect(good(1)).toHaveAttribute("aria-pressed", "true");
	await expect(bad(2)).toHaveAttribute("aria-pressed", "true");

	await page.reload();
	await expect(pane(page, 1).getByText(e2eMockReply("alpha"))).toBeVisible();
	await expect(good(1)).toHaveAttribute("aria-pressed", "true");
	await expect(bad(1)).toHaveAttribute("aria-pressed", "false");
	await expect(bad(2)).toHaveAttribute("aria-pressed", "true");

	// Pressing a vote again clears it, and that sticks too.
	await good(1).click();
	await expect(good(1)).toHaveAttribute("aria-pressed", "false");
	await page.reload();
	await expect(pane(page, 1).getByText(e2eMockReply("alpha"))).toBeVisible();
	await expect(good(1)).toHaveAttribute("aria-pressed", "false");
	await expect(bad(2)).toHaveAttribute("aria-pressed", "true");
});

test("sync scroll moves the other panes only while it's on", async ({
	page,
	context,
}) => {
	await setUp(context, page, e2eMockModel("alpha"));
	// A tall question makes both panes scroll.
	await comparedOnce(
		page,
		Array.from({ length: 80 }, (_, i) => `Line ${i + 1}`).join("\n"),
	);
	const toggle = page.getByRole("switch", { name: "Sync scroll" });
	await expect(toggle).not.toBeChecked();

	await toggle.click();
	await expect(toggle).toBeChecked();
	await scrollTo(pane(page, 1), "top");
	await expect.poll(() => ratioOf(pane(page, 2))).toBeLessThan(0.02);
	await scrollTo(pane(page, 1), "bottom");
	await expect.poll(() => ratioOf(pane(page, 2))).toBeGreaterThan(0.98);

	await toggle.click();
	await expect(toggle).not.toBeChecked();
	await scrollTo(pane(page, 1), "top");
	await expect.poll(() => ratioOf(pane(page, 1))).toBeLessThan(0.02);
	// Give a stray listener a chance to move pane 2 before checking it didn't.
	await page.waitForTimeout(200);
	expect(await ratioOf(pane(page, 2))).toBeGreaterThan(0.98);
});

test("copy settings to all panes gives the others this pane's settings", async ({
	page,
	context,
}) => {
	await setUp(context, page, e2eMockModel("alpha"));
	await openWorkspace(page, 3);
	const settingsOf = async (n: number) => {
		await pane(page, n).getByRole("button", { name: "Model settings" }).click();
		return page.getByRole("dialog", { name: "Model settings" });
	};

	const panel = await settingsOf(1);
	await panel
		.getByLabel("System prompt for this chat")
		.fill("Answer in haiku.");
	await panel.getByLabel("System prompt for this chat").blur();
	await page.keyboard.press("Escape");
	await expect(panel).toBeHidden();

	await pane(page, 1)
		.getByRole("button", { name: "Options for Pane 1" })
		.click();
	await page
		.getByRole("menuitem", { name: "Copy settings to all panes" })
		.click();

	for (const n of [2, 3]) {
		const other = await settingsOf(n);
		await expect(other.getByLabel("System prompt for this chat")).toHaveValue(
			"Answer in haiku.",
		);
		await page.keyboard.press("Escape");
		await expect(other).toBeHidden();
	}
	// Each pane keeps its own model.
	await expect(
		pane(page, 2).getByRole("button", { name: /^Model: / }),
	).toContainText(e2eMockModel("alpha"));
});
