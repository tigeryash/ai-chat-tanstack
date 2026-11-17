import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";

// Roadmap R2 S9: theme presets, corner radius, reading width and code colors. A preset is on <html>
// before the first frame (the <head> script replays it), it never restyles the composer (hard rule
// 8), and editing anything after picking it reads "Custom (from …)".

test.use({ colorScheme: "dark" });

/** <body>'s background in the first animation frame, before first paint. */
async function recordFirstBackground(page: Page) {
	await page.addInitScript(() => {
		requestAnimationFrame(() => {
			(window as unknown as { __firstBackground: string }).__firstBackground =
				getComputedStyle(document.body).backgroundColor;
		});
	});
}

const firstBackground = (page: Page) =>
	page.evaluate(
		() =>
			(window as unknown as { __firstBackground?: string }).__firstBackground,
	);

const appearance = (page: Page) =>
	page.getByRole("region", { name: "Appearance" });

const bodyBackground = (page: Page) =>
	page.evaluate(() => getComputedStyle(document.body).backgroundColor);

const composerLook = (page: Page) =>
	page.locator(".composer-design").evaluate((el) => {
		const style = getComputedStyle(el);
		return {
			color: style.color,
			background: style.backgroundColor,
			radius: style.borderTopLeftRadius,
			font: style.fontFamily,
		};
	});

// Paper's dark page, #1d1a17.
const PAPER_DARK = "rgb(29, 26, 23)";
const DEFAULT_DARK = "oklch(0 0 0)";

test("a preset applies, survives a reload with no flash, and edits into Custom", async ({
	page,
}) => {
	await recordFirstBackground(page);
	await page.goto("/new");
	const composerBefore = await composerLook(page);

	await page.goto("/new?settings=appearance");
	const section = appearance(page);
	const presets = section.getByRole("radiogroup", { name: "Preset" });
	await expect(presets.getByRole("radio", { name: "Default" })).toHaveAttribute(
		"aria-checked",
		"true",
	);
	await presets.getByRole("radio", { name: "Paper" }).click();
	await expect(presets.getByRole("radio", { name: "Paper" })).toHaveAttribute(
		"aria-checked",
		"true",
	);
	await expect(section.getByTestId("preset-status")).toHaveText("Using Paper.");
	await expect.poll(() => bodyBackground(page)).toBe(PAPER_DARK);

	await page.goto("/new");
	expect(await firstBackground(page)).toBe(PAPER_DARK);
	await expect(page.locator("html")).toHaveCSS(
		"--reading-font",
		/Source Serif 4 Variable/,
	);
	expect(await composerLook(page)).toEqual(composerBefore);

	await page.goto("/new?settings=appearance");
	const edited = appearance(page);
	await edited.getByRole("radio", { name: "Sharp" }).click();
	await expect(edited.getByTestId("preset-status")).toHaveText(
		"Custom (from Paper). Pick a preset to start over.",
	);
	await expect(
		edited
			.getByRole("radiogroup", { name: "Preset" })
			.getByRole("radio", { checked: true }),
	).toHaveCount(0);
	await expect(page.locator("html")).toHaveCSS("--pane-radius", "0.25rem");

	// The edit is kept: still Paper's colors, now with sharp corners, from the first frame.
	await page.reload();
	expect(await firstBackground(page)).toBe(PAPER_DARK);
	await expect(page.locator("html")).toHaveCSS("--pane-radius", "0.25rem");
	await expect(appearance(page).getByTestId("preset-status")).toContainText(
		"Custom (from Paper)",
	);

	await appearance(page)
		.getByRole("radiogroup", { name: "Preset" })
		.getByRole("radio", { name: "Default" })
		.click();
	await expect.poll(() => bodyBackground(page)).toBe(DEFAULT_DARK);
});

test("reading width and code colors apply", async ({ page }) => {
	await page.goto("/new?settings=appearance");
	const section = appearance(page);
	await section.getByRole("radio", { name: "Narrow" }).click();
	await expect(page.locator("html")).toHaveCSS(
		"--reading-width",
		"min(80%, 42rem)",
	);

	const keyword = page
		.locator('[data-streamdown="code-block-body"] span')
		.filter({ hasText: /^const$/ });
	// "Follow the theme" on the Default preset is GitHub Dark: `const` is #f97583.
	await page.goto("/e2e/markdown?code=true");
	await expect(keyword).toHaveCSS("color", "rgb(249, 117, 131)");

	await page.goto("/new?settings=appearance");
	await appearance(page).getByLabel("Code colors").selectOption("solarized");
	// Solarized Dark colors it #93a1a1.
	await page.goto("/e2e/markdown?code=true");
	await expect(keyword).toHaveCSS("color", "rgb(147, 161, 161)");
});

test("presets are on the palette's Switch theme page", async ({ page }) => {
	await page.goto("/new");
	await expect(page.getByPlaceholder("Ask anything")).toBeVisible();
	await page.keyboard.press("ControlOrMeta+K");
	const palette = page.getByRole("dialog", { name: "Command palette" });
	await expect(palette.getByRole("combobox")).toBeFocused();
	await palette.getByRole("combobox").fill("switch theme");
	await page.keyboard.press("Enter");
	await palette.getByRole("combobox").fill("nord");
	await page.keyboard.press("Enter");
	await expect.poll(() => bodyBackground(page)).toBe("rgb(46, 52, 64)"); // Nord's dark page, #2e3440.
	await expect(
		palette.getByRole("option", { name: /Theme: Nord-style/ }),
	).toHaveAttribute("aria-checked", "true");
});
