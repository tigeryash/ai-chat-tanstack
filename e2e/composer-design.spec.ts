import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";

// The composer is Yash's design (CLAUDE.md hard rule 8). These screenshots pin how it looks and how
// its icons animate, in light and dark: it is the same white pill in both. A failure here means a
// change reached the composer's look; put it back. Refresh these baselines only after Yash approved a
// mockup or screenshot of the change, never to get a slice through CI.
//
// Hover frames run on Playwright's clock. It starts and pauses at fixed times, so Motion starts the
// icon's animation on the same frame and `runFor` steps it to the same frame every run.
const CLOCK_START = new Date("2026-01-01T00:00:00Z");
// Later than loading the page and setting up a hover ever takes.
const HOVER_AT = new Date("2026-01-01T00:01:00Z");

// Room around the composer for its shadow.
const MARGIN = 24;

// A 1x1 PNG.
const PIXEL = {
	name: "pixel.png",
	mimeType: "image/png",
	buffer: Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
		"base64",
	),
};

// The composer's box once its resize and morph are over: three reads 100 ms apart agree.
async function settledBox(page: Page) {
	const form = page.locator("form");
	const boxes: string[] = [];
	await expect
		.poll(
			async () => {
				boxes.push(JSON.stringify(await form.boundingBox()));
				return (
					boxes.length >= 3 &&
					boxes.slice(-3).every((box) => box === boxes.at(-1))
				);
			},
			{ intervals: [100] },
		)
		.toBe(true);
	const box = await form.boundingBox();
	if (!box) throw new Error("composer not found");
	return box;
}

async function expectComposer(page: Page, name: string) {
	const box = await settledBox(page);
	await expect(page).toHaveScreenshot(name, {
		clip: {
			x: Math.floor(box.x - MARGIN),
			y: Math.floor(box.y - MARGIN),
			width: Math.ceil(box.width + 2 * MARGIN),
			height: Math.ceil(box.height + 2 * MARGIN),
		},
	});
}

async function openComposer(page: Page) {
	await page.goto("/e2e/composer");
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();
}

// Opens the composer on Playwright's clock (installed before the page loads, so Motion runs on it).
async function openComposerOnClock(page: Page) {
	await page.clock.install({ time: CLOCK_START });
	await openComposer(page);
}

// Hovers `target` with the clock paused, gives React the hover in real time, then plays `ms` of the
// icon's animation. CSS hover styles and the tooltip's fade finish on their own (screenshots end CSS
// animations and transitions).
async function hoverFrame(page: Page, target: Locator, ms: number) {
	const box = await target.boundingBox();
	if (!box) throw new Error("hover target not found");
	await page.clock.pauseAt(HOVER_AT);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.waitForTimeout(300);
	await page.clock.runFor(ms);
}

for (const scheme of ["light", "dark"] as const) {
	test.describe(`in ${scheme} mode`, () => {
		test.use({ colorScheme: scheme });

		test("keeps its own colors, not the theme's", async ({ page }) => {
			await openComposer(page);
			await expect(page.locator("form")).toHaveCSS(
				"background-color",
				"rgb(255, 255, 255)",
			);
			await expect(page.getByPlaceholder("Ask anything")).toHaveCSS(
				"color",
				"rgb(0, 0, 0)",
			);
		});

		test("rests as a pill with its buttons", async ({ page }) => {
			await openComposer(page);
			// Attach, web search, deep research, voice input and voice chat; Send appears with text.
			await expect(page.locator("form .input-button:visible")).toHaveCount(5);
			await expect(page.locator("form")).toHaveCSS("border-radius", "9999px");
			await expectComposer(page, `composer-rest-${scheme}.png`);
		});

		test("becomes a card for a multi-line message", async ({ page }) => {
			await openComposer(page);
			await page
				.getByPlaceholder("Ask anything")
				.fill("First line\nSecond line\nThird line");
			await expect(page.locator("form")).toHaveCSS("border-radius", "12px");
			await expectComposer(page, `composer-expanded-${scheme}.png`);
		});

		test("shows attached files as chips", async ({ page }) => {
			await openComposer(page);
			await page.locator('input[type="file"]').setInputFiles([
				PIXEL,
				{
					name: "notes.txt",
					mimeType: "text/plain",
					buffer: Buffer.from("hi"),
				},
			]);
			await expect(
				page.getByRole("button", { name: "Remove notes.txt" }),
			).toBeAttached();
			await expect(page.locator("form .animate-spin")).toHaveCount(0);
			await expectComposer(page, `composer-files-${scheme}.png`);
		});

		test("the plane flies off while Send is hovered", async ({ page }) => {
			await openComposerOnClock(page);
			await page.getByPlaceholder("Ask anything").fill("Hello");
			await hoverFrame(page, page.getByRole("button", { name: "Send" }), 450);
			await expectComposer(page, `composer-hover-send-${scheme}.png`);
		});

		test("the paperclip redraws while hovered, under its tooltip", async ({
			page,
		}) => {
			await openComposerOnClock(page);
			await hoverFrame(
				page,
				page.getByRole("button", { name: "Upload files" }),
				600,
			);
			await expect(page.getByText("Attach File")).toBeVisible();
			await expectComposer(page, `composer-hover-paperclip-${scheme}.png`);
		});
	});
}
