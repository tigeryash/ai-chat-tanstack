import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";

// Roadmap 2.5 and 2.5b: tokens, TTFT, tokens/sec and cost per reply (behind its ⋯ button), and the chat's total per provider, from a
// fixture chat's saved metadata (/e2e/usage, src/lib/chat/usage.fixtures.ts).

test.beforeEach(async ({ page }) => {
	await page.goto("/e2e/usage");
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();
});

/** The rows of the open "⋯" popover, as "Label: value". */
function detailRows(page: Page) {
	return page
		.locator("[data-usage='reply'] [data-reply-detail]")
		.evaluateAll((rows) =>
			rows.map(
				(row) =>
					`${row.querySelector("dt")?.textContent}: ${row.querySelector("dd")?.textContent}`,
			),
		);
}

test("a reply's tokens and timings sit behind its ⋯ button, with the host and cost", async ({
	page,
}) => {
	// Roadmap 2.5b: nothing shows inline; it's all behind ⋯.
	const footers = page.locator("[data-slot='message-footer']");
	await expect(footers).toHaveCount(3);
	await expect(footers.first()).not.toContainText("tokens");
	await expect(footers.first()).not.toContainText("TTFT");
	await expect(footers.first()).not.toContainText("via");
	await expect(page.locator("[data-usage='reply']")).toHaveCount(0);

	const more = page.getByRole("button", { name: "Reply details" });
	await expect(more).toHaveCount(3);
	await more.first().click();
	await expect(page.getByText("Reply details", { exact: true })).toBeVisible();
	expect(await detailRows(page)).toEqual([
		"Model: deepseek/deepseek-v4.1-flash",
		"Host: OpenRouter → DeepInfra",
		"Cost: $0.0042",
		"Tokens: 1,540",
		"Input: 1,200",
		"Output: 340 (90 reasoning)",
		"Time to first token: 420 ms",
		"Speed: 52 tok/s",
	]);
	await page.keyboard.press("Escape");
	await expect(page.locator("[data-usage='reply']")).toHaveCount(0);

	await more.nth(1).click();
	await expect
		.poll(() => detailRows(page))
		.toContain("Cost: ~$0.0011 (estimated from list prices)");
});

test("the header shows the chat's cost, and the popover splits it by provider", async ({
	page,
}) => {
	const total = page.locator("[data-usage='chat']");
	await expect(total).toHaveText("~$0.0053 · 5.4K tokens");
	await total.click();
	const rows = page.getByRole("row");
	await expect(rows).toHaveText([
		"OpenRouter1 reply1.5K tokens$0.0042",
		"Fireworks1 reply1.8K tokens~$0.0011",
		"Local1 reply2.1K tokensNo price",
		"Total3 replies5.4K tokens~$0.0053",
	]);
	await expect(page.getByText(/estimated from list prices/)).toBeVisible();
	await expect(page.getByText(/1 reply had no price/)).toBeVisible();
});

test.describe("on a phone", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("the ⋯ button opens a reply's details from the keyboard", async ({
		page,
	}) => {
		const more = page.getByRole("button", { name: "Reply details" }).last();
		await more.focus();
		await page.keyboard.press("Enter");
		await expect
			.poll(() => detailRows(page))
			.toEqual([
				"Model: qwen3-8b",
				"Host: Local",
				"Cost: No price",
				"Tokens: 2,050",
				"Input: 1,900",
				"Output: 150",
				"Time to first token: 95 ms",
			]);
		// The popover stays inside the phone's width.
		const box = await page.locator("[data-usage='reply']").boundingBox();
		expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
	});

	test("the header keeps only an icon for the chat's usage, which still opens the breakdown", async ({
		page,
	}) => {
		const total = page.locator("[data-usage='chat']");
		await expect(total).toHaveAccessibleName(
			"This chat: ~$0.0053, 5.4K tokens. Usage by provider",
		);
		await expect(total.locator("[data-usage-total]")).toBeHidden();
		await total.click();
		await expect(page.getByRole("row").last()).toHaveText(
			"Total3 replies5.4K tokens~$0.0053",
		);
	});
});
