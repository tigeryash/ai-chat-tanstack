import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";

// Hard rule 3 (roadmap 0.8): with the OS "Reduce motion" setting on, the composer resizes without
// animating, the GSAP reveals on the auth pages are instant, and the WebGL background is one still
// frame. Each check has a full-motion twin, which shows the probe can see motion and that the
// normal animations still play.

const MULTI_LINE_MESSAGE = "one\ntwo\nthree\nfour";
// The other auth pages share the login form's reveal (src/components/auth/auth-form.tsx).
const OTHER_AUTH_PAGES = [
	"/signup",
	"/forgot-password",
	"/reset-password?token=test-reset-token",
];

// Types into the composer from inside the page and records the form's height on every animation
// frame for about 0.75 s, so the samples don't depend on Playwright round trips.
async function composerHeightsWhileTyping(page: Page, text: string) {
	return page.evaluate(async (value) => {
		const form = document.querySelector("form");
		const textarea = document.querySelector("textarea");
		if (!form || !textarea) throw new Error("composer not found");

		const heights = [form.getBoundingClientRect().height];
		// React tracks the value through the native setter, so set it there and fire `input`.
		Object.getOwnPropertyDescriptor(
			HTMLTextAreaElement.prototype,
			"value",
		)?.set?.call(textarea, value);
		textarea.dispatchEvent(new Event("input", { bubbles: true }));

		for (let frame = 0; frame < 45; frame++) {
			await new Promise(requestAnimationFrame);
			heights.push(form.getBoundingClientRect().height);
		}
		return heights;
	}, text);
}

// Heights strictly between where the composer started and where it settled: animation frames.
function inBetweenHeights(heights: number[]) {
	const start = heights[0] ?? 0;
	const end = heights[heights.length - 1] ?? 0;
	const [low, high] = [Math.min(start, end), Math.max(start, end)];
	return heights.filter((height) => height > low + 0.5 && height < high - 0.5);
}

// From the first frame on, remembers the lowest opacity any GSAP reveal target shows. The reveals
// fade these in from 0, so with full motion the number drops; with reduced motion it stays 1.
async function recordRevealOpacity(page: Page) {
	await page.addInitScript(() => {
		const record = window as unknown as { lowestRevealOpacity: number };
		record.lowestRevealOpacity = 1;
		const sample = () => {
			for (const element of document.querySelectorAll(
				".auth, .form-root, .auth-button > button",
			)) {
				record.lowestRevealOpacity = Math.min(
					record.lowestRevealOpacity,
					Number(getComputedStyle(element).opacity),
				);
			}
			requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	});
}

function lowestRevealOpacity(page: Page) {
	return page.evaluate(
		() =>
			(window as unknown as { lowestRevealOpacity: number })
				.lowestRevealOpacity,
	);
}

// Screenshots of the canvas's area with the page content layered over it hidden. A page screenshot
// clipped to the canvas, because an element screenshot would wait forever for a hidden canvas.
const HIDE_CONTENT =
	"main > :not(:has(canvas)) { visibility: hidden !important; }";

async function canvasAreaShot(page: Page, style: string) {
	const clip = await page.locator("canvas").boundingBox();
	if (!clip) throw new Error("canvas has no box");
	return page.screenshot({ clip, style });
}

function sceneShot(page: Page) {
	return canvasAreaShot(page, HIDE_CONTENT);
}

// The same area with the canvas hidden too: what shows if WebGL drew nothing.
function backgroundShot(page: Page) {
	return canvasAreaShot(
		page,
		`${HIDE_CONTENT} canvas { visibility: hidden !important; }`,
	);
}

async function looksTheSameAfter(
	page: Page,
	ms: number,
	shoot: () => Promise<Buffer>,
) {
	const before = await shoot();
	await page.waitForTimeout(ms);
	return (await shoot()).equals(before);
}

test.describe("with Reduce motion on", () => {
	test.use({ reducedMotion: "reduce" });

	test("the composer resizes without animating", async ({ page }) => {
		await page.goto("/e2e/composer");
		await expect(page.locator("main[data-hydrated='true']")).toBeAttached();

		const heights = await composerHeightsWhileTyping(page, MULTI_LINE_MESSAGE);

		expect(heights[heights.length - 1]).toBeGreaterThan(heights[0] ?? 0);
		expect(inBetweenHeights(heights)).toEqual([]);
	});

	test("login reveals are instant and the WebGL scene is one still frame", async ({
		page,
	}) => {
		await recordRevealOpacity(page);
		await page.goto("/login");
		// The scene mounts after hydration, which is when the reveals would start.
		await expect(page.locator("canvas")).toBeVisible();

		// Once the first frame and layout have landed, nothing on the page moves: no reveals, no
		// scrolling model strip, no wave.
		await expect
			.poll(() => looksTheSameAfter(page, 250, () => page.screenshot()), {
				timeout: 10_000,
			})
			.toBe(true);
		expect(await looksTheSameAfter(page, 1_500, () => page.screenshot())).toBe(
			true,
		);

		expect(await lowestRevealOpacity(page)).toBe(1);
		// The still frame is a real frame, not an empty canvas.
		expect((await sceneShot(page)).equals(await backgroundShot(page))).toBe(
			false,
		);
	});

	for (const path of OTHER_AUTH_PAGES) {
		test(`${path} reveals are instant`, async ({ page }) => {
			await recordRevealOpacity(page);
			await page.goto(path);
			await expect(page.locator("canvas")).toBeVisible();
			// Longer than the reveals' start delay, so a reveal that ran would have dimmed something.
			await page.waitForTimeout(1_000);

			expect(await lowestRevealOpacity(page)).toBe(1);
		});
	}
});

test.describe("with full motion", () => {
	test.use({ reducedMotion: "no-preference" });

	test("the composer animates its resize", async ({ page }) => {
		await page.goto("/e2e/composer");
		await expect(page.locator("main[data-hydrated='true']")).toBeAttached();

		const heights = await composerHeightsWhileTyping(page, MULTI_LINE_MESSAGE);

		expect(inBetweenHeights(heights).length).toBeGreaterThan(0);
	});

	test("login reveals play and the WebGL scene moves", async ({ page }) => {
		await recordRevealOpacity(page);
		await page.goto("/login");
		await expect(page.locator("canvas")).toBeVisible();

		await expect.poll(() => lowestRevealOpacity(page)).toBeLessThan(1);
		// Give the scene a moment to draw its first frames before comparing two of them.
		await page.waitForTimeout(1_000);
		expect(await looksTheSameAfter(page, 500, () => sceneShot(page))).toBe(
			false,
		);
	});

	for (const path of OTHER_AUTH_PAGES) {
		test(`${path} reveals play`, async ({ page }) => {
			await recordRevealOpacity(page);
			await page.goto(path);
			await expect(page.locator("canvas")).toBeVisible();

			await expect.poll(() => lowestRevealOpacity(page)).toBeLessThan(1);
		});
	}
});
