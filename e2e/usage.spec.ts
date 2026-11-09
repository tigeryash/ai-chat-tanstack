import { expect, test } from "./support/fixtures";

// Roadmap 2.5: tokens, TTFT, tokens/sec and cost per reply, and the chat's total per provider, from a
// fixture chat's saved metadata (/e2e/usage, src/lib/chat/usage.fixtures.ts).

test.beforeEach(async ({ page }) => {
	await page.goto("/e2e/usage");
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();
});

test("each reply shows its tokens, TTFT and speed, with the split on hover", async ({
	page,
}) => {
	const stats = page.locator("[data-usage='reply']");
	await expect(stats).toHaveText([
		"· 1.5K tokens · TTFT 420 ms · 52 tok/s",
		"· 1.8K tokens · TTFT 1.8 s · 120 tok/s",
		"· 2.1K tokens · TTFT 95 ms",
	]);
	await stats.first().hover();
	await expect(
		page.getByText(
			"1,200 input + 340 output (90 reasoning) tokens · 420 ms to first token · 52 tok/s after it",
		),
	).toBeVisible();
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
