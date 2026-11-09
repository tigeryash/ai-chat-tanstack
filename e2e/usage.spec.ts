import type { Page } from "@playwright/test";
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
	const items = (n: number) => stats.nth(n).locator("[data-usage-item]");
	await expect(stats).toHaveCount(3);
	await expect(items(0)).toHaveText(["1.5K tokens", "TTFT 420 ms", "52 tok/s"]);
	await expect(items(1)).toHaveText(["1.8K tokens", "TTFT 1.8 s", "120 tok/s"]);
	await expect(items(2)).toHaveText(["2.1K tokens", "TTFT 95 ms"]);
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

/**
 * Every "·" separator under the replies (a `::before` that sits outside its item), with whether its item
 * starts a wrapped line and whether the overflow clip lets the separator show.
 */
function separators(page: Page) {
	return page.locator("[data-slot='message-footer']").evaluateAll((footers) =>
		footers.flatMap((footer) =>
			[...footer.querySelectorAll<HTMLElement>("*")].flatMap((item) => {
				const before = getComputedStyle(item, "::before");
				if (before.content !== '"·"') return [];
				let clip = item.parentElement;
				while (clip && getComputedStyle(clip).overflow !== "hidden") {
					clip = clip.parentElement;
				}
				if (!clip) throw new Error("A separator has no clipping parent");
				const left = item.getBoundingClientRect().left;
				const sepRight = left - Number.parseFloat(before.marginRight);
				const sepLeft = sepRight - Number.parseFloat(before.width);
				const siblings = [...(item.parentElement?.children ?? [])];
				const lineStart = Math.min(
					...siblings.map((el) => el.getBoundingClientRect().left),
				);
				return [
					{
						text: item.textContent,
						startsLine: Math.abs(left - lineStart) < 1,
						shows: sepLeft >= clip.getBoundingClientRect().left,
					},
				];
			}),
		),
	);
}

test.describe("on a phone", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("stats wrap between items, never inside one, and a line never starts with a separator", async ({
		page,
	}) => {
		const items = page.locator("[data-usage-item]");
		await expect(items).toHaveCount(8);
		for (const item of await items.all()) {
			const lines = await item.evaluate((el) => el.getClientRects().length);
			expect(lines).toBe(1);
		}
		const seps = await separators(page);
		// At this width the stats move under the "via …" line, so some separators start a line.
		expect(seps.some((sep) => sep.startsLine)).toBe(true);
		for (const sep of seps)
			expect(sep, sep.text ?? "").toEqual({ ...sep, shows: !sep.startsLine });
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
