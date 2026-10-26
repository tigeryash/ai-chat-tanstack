import type { Locator } from "@playwright/test";
import { expect, test } from "./support/fixtures";

// How chat messages lay out (/e2e/messages). The person's messages are bubbles on the right that keep
// their text exactly as typed; replies render as markdown.

test.beforeEach(async ({ page }) => {
	await page.goto("/e2e/messages");
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();
});

// The bubble whose text starts with `start` ("Test" must not also match "wait still testing stuff").
const userBubble = (page: import("@playwright/test").Page, start: string) =>
	page
		.locator(
			"[data-slot='message'][data-align='end'] [data-slot='bubble-content']",
		)
		.filter({
			hasText: new RegExp(`^${start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
		});

async function lineCount(bubble: Locator) {
	return bubble.evaluate((element) => {
		const text = element.querySelector("p") ?? element;
		const style = getComputedStyle(element);
		const padding =
			Number.parseFloat(style.paddingTop) +
			Number.parseFloat(style.paddingBottom);
		const lineHeight = Number.parseFloat(getComputedStyle(text).lineHeight);
		return Math.round(
			(element.getBoundingClientRect().height - padding) / lineHeight,
		);
	});
}

test("short messages stay on one line", async ({ page }) => {
	// Before the fix, every user bubble was capped at 80% of its own text width, so even "Test" wrapped.
	for (const text of [
		"Test",
		"wait still testing stuff",
		"hiiiiiiiiiiiiiiiiiiii",
	]) {
		const bubble = userBubble(page, text);
		await expect(bubble).toBeVisible();
		expect(await lineCount(bubble), text).toBe(1);
	}
});

test("long messages wrap at 80% of the conversation width, aligned right", async ({
	page,
}) => {
	const bubble = userBubble(page, "A long message that has to wrap.");
	const column = bubble.locator(
		"xpath=ancestor::*[@data-slot='message-content'][1]",
	);

	const [bubbleBox, columnBox] = await Promise.all([
		bubble.boundingBox(),
		column.boundingBox(),
	]);
	if (!bubbleBox || !columnBox) throw new Error("layout boxes missing");

	expect(await lineCount(bubble)).toBeGreaterThan(1);
	expect(bubbleBox.width).toBeLessThanOrEqual(columnBox.width * 0.8 + 1);
	expect(bubbleBox.width).toBeGreaterThan(columnBox.width * 0.6);
	expect(
		Math.abs(bubbleBox.x + bubbleBox.width - (columnBox.x + columnBox.width)),
	).toBeLessThan(2);
});

test("the person's text keeps its line breaks and isn't parsed as markdown", async ({
	page,
}) => {
	const multiline = userBubble(page, "first line");
	await expect(multiline.locator("p")).toHaveText(
		"first line\nsecond line\n\n  indented after a blank line",
		{ useInnerText: true },
	);
	expect(await lineCount(multiline)).toBe(4);

	const markdownLike = userBubble(page, "# not a heading");
	await expect(markdownLike.locator("p")).toHaveText(
		"# not a heading and **not bold**",
	);
	await expect(
		markdownLike.locator("h1, strong, [data-streamdown]"),
	).toHaveCount(0);
});

test("replies still render markdown", async ({ page }) => {
	// Streamdown renders bold as a span, not <strong>.
	await expect(
		page
			.locator("[data-slot='message'][data-align='start']")
			.locator("[data-streamdown='strong']", { hasText: "Markdown" }),
	).toBeVisible();
});
