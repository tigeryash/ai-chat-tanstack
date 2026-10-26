import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";

// Hard rule 3 (roadmap 0.8): with the OS "Reduce motion" setting on, the composer resizes without
// animating, the GSAP reveals on the auth pages are instant, and the WebGL background is one still
// frame. Outside Motion and GSAP, CSS transitions and animations finish instantly (the reduced-motion
// rule in `styles.css`), the "Thinking..." shimmer is still text, and loading spinners keep turning.
// Each check has a full-motion twin, which shows the probe can see motion and that the normal
// animations still play.

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

// Samples strictly between where a measurement started and where it settled: animation frames.
function inBetween(samples: number[]) {
	const start = samples[0] ?? 0;
	const end = samples[samples.length - 1] ?? 0;
	const [low, high] = [Math.min(start, end), Math.max(start, end)];
	return samples.filter((sample) => sample > low + 0.5 && sample < high - 0.5);
}

const REVEAL_TARGETS = [
	".auth",
	".form-root",
	".auth-button > button",
	".footer",
];

// From the first frame on, remembers the lowest opacity each GSAP reveal target shows. The reveals
// fade these in from 0, so with full motion the numbers drop; with reduced motion they stay 1.
async function recordRevealOpacity(page: Page) {
	await page.addInitScript((targets) => {
		const lowest: Record<string, number> = {};
		(
			window as unknown as { lowestRevealOpacity: typeof lowest }
		).lowestRevealOpacity = lowest;
		const sample = () => {
			for (const target of targets) {
				for (const element of document.querySelectorAll(target)) {
					lowest[target] = Math.min(
						lowest[target] ?? 1,
						Number(getComputedStyle(element).opacity),
					);
				}
			}
			requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	}, REVEAL_TARGETS);
}

// The reveal targets that have shown an opacity below 1 so far, in REVEAL_TARGETS order.
function fadedRevealTargets(page: Page) {
	return page.evaluate((targets) => {
		const lowest = (
			window as unknown as { lowestRevealOpacity: Record<string, number> }
		).lowestRevealOpacity;
		return targets.filter((target) => (lowest[target] ?? 1) < 1);
	}, REVEAL_TARGETS);
}

// Moves the mouse onto a button and records its rendered width (hover scale included) on every
// animation frame for about 0.75 s. Sampling starts before the mouse arrives, so the first sample is
// the resting width.
async function buttonWidthsWhileHovering(page: Page, button: Locator) {
	const box = await button.boundingBox();
	if (!box) throw new Error("button has no box");
	await button.evaluate((element) => {
		const record = window as unknown as { hoverWidths?: number[] };
		const widths = [element.getBoundingClientRect().width];
		const sample = () => {
			widths.push(element.getBoundingClientRect().width);
			if (widths.length < 46) requestAnimationFrame(sample);
			else record.hoverWidths = widths;
		};
		requestAnimationFrame(sample);
	});
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.waitForFunction(
		() => (window as unknown as { hoverWidths?: number[] }).hoverWidths,
	);
	return page.evaluate(
		() => (window as unknown as { hoverWidths: number[] }).hoverWidths,
	);
}

// From the first frame on, records the opacity of the composer's tooltip on every frame it is open.
async function recordTooltipOpacity(page: Page) {
	await page.addInitScript(() => {
		const opacities: number[] = [];
		(window as unknown as { tooltipOpacities: number[] }).tooltipOpacities =
			opacities;
		const sample = () => {
			const tooltip = document.querySelector("[data-slot='tooltip-content']");
			if (tooltip) opacities.push(Number(getComputedStyle(tooltip).opacity));
			requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	});
}

// Hovers the composer's attach button until its tooltip is open and settled, then returns the
// tooltip opacities that were neither hidden nor fully shown: frames of a fade.
async function tooltipFadeFrames(page: Page) {
	await page.getByRole("button", { name: "Upload files" }).hover();
	await expect(page.locator("[data-slot='tooltip-content']")).toBeVisible();
	await page.waitForTimeout(500);
	const opacities = await page.evaluate(
		() =>
			(window as unknown as { tooltipOpacities: number[] }).tooltipOpacities,
	);
	expect(opacities.at(-1)).toBe(1);
	return opacities.filter((opacity) => opacity > 0.01 && opacity < 0.99);
}

// How many different values a computed style property takes over about half a second of frames.
function distinctStyleValues(element: Locator, property: string) {
	return element.evaluate(async (target, name) => {
		const values = new Set<string>();
		for (let frame = 0; frame < 30; frame++) {
			values.add(getComputedStyle(target).getPropertyValue(name));
			await new Promise(requestAnimationFrame);
		}
		return values.size;
	}, property);
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
		expect(inBetween(heights)).toEqual([]);
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

		expect(await fadedRevealTargets(page)).toEqual([]);
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

			expect(await fadedRevealTargets(page)).toEqual([]);
		});
	}

	test("the Login button grows on hover without a transition", async ({
		page,
	}) => {
		await page.goto("/login");
		await expect(page.locator("canvas")).toBeVisible();

		const widths = await buttonWidthsWhileHovering(
			page,
			page.getByRole("button", { name: "Login", exact: true }),
		);

		expect(widths[widths.length - 1]).toBeGreaterThan(widths[0] ?? 0);
		expect(inBetween(widths)).toEqual([]);
	});

	test("the composer's tooltip appears without fading in", async ({ page }) => {
		await recordTooltipOpacity(page);
		await page.goto("/e2e/composer");
		await expect(page.locator("main[data-hydrated='true']")).toBeAttached();

		expect(await tooltipFadeFrames(page)).toEqual([]);
	});

	test("the Thinking... shimmer is still text", async ({ page }) => {
		await page.goto("/e2e/loading");
		await expect(page.locator("main[data-hydrated='true']")).toBeAttached();
		const shimmer = page.getByText("Thinking...");

		// Readable text, not the shimmer's transparent text over a frozen gradient (the shimmer utility
		// hides the text through -webkit-text-fill-color and paints it with the background).
		await expect(shimmer).not.toHaveCSS(
			"-webkit-text-fill-color",
			"rgba(0, 0, 0, 0)",
		);
		expect(await distinctStyleValues(shimmer, "background-position")).toBe(1);
	});

	test("loading spinners keep turning", async ({ page }) => {
		await page.goto("/e2e/loading");

		// A stopped spinner looks like a plain icon and no longer says "working", so it keeps turning.
		expect(
			await distinctStyleValues(page.locator(".animate-spin"), "transform"),
		).toBeGreaterThan(1);
	});
});

test.describe("with full motion", () => {
	test.use({ reducedMotion: "no-preference" });

	test("the composer animates its resize", async ({ page }) => {
		await page.goto("/e2e/composer");
		await expect(page.locator("main[data-hydrated='true']")).toBeAttached();

		const heights = await composerHeightsWhileTyping(page, MULTI_LINE_MESSAGE);

		expect(inBetween(heights).length).toBeGreaterThan(0);
	});

	test("login reveals play and the WebGL scene moves", async ({ page }) => {
		await recordRevealOpacity(page);
		await page.goto("/login");
		await expect(page.locator("canvas")).toBeVisible();

		await expect.poll(() => fadedRevealTargets(page)).toEqual(REVEAL_TARGETS);
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

			await expect.poll(() => fadedRevealTargets(page)).toEqual(REVEAL_TARGETS);
		});
	}

	test("the Login button eases into its hover growth", async ({ page }) => {
		await page.goto("/login");
		await expect(page.locator("canvas")).toBeVisible();

		const widths = await buttonWidthsWhileHovering(
			page,
			page.getByRole("button", { name: "Login", exact: true }),
		);

		expect(inBetween(widths).length).toBeGreaterThan(0);
	});

	test("the composer's tooltip fades in", async ({ page }) => {
		await recordTooltipOpacity(page);
		await page.goto("/e2e/composer");
		await expect(page.locator("main[data-hydrated='true']")).toBeAttached();

		expect((await tooltipFadeFrames(page)).length).toBeGreaterThan(0);
	});

	test("the Thinking... shimmer sweeps", async ({ page }) => {
		await page.goto("/e2e/loading");
		await expect(page.locator("main[data-hydrated='true']")).toBeAttached();

		expect(
			await distinctStyleValues(
				page.getByText("Thinking..."),
				"background-position",
			),
		).toBeGreaterThan(1);
	});

	test("loading spinners turn", async ({ page }) => {
		await page.goto("/e2e/loading");

		expect(
			await distinctStyleValues(page.locator(".animate-spin"), "transform"),
		).toBeGreaterThan(1);
	});
});
