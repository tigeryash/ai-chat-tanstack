import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";

// Roadmap 3.11: Settings → Appearance. Settings persist across reloads and are on <html> before the
// first frame (the nonce'd <head> script), so the default theme never flashes. Runs in the
// `csp-enforced` project too, and the fixture fails on any CSP violation either way.

// The system says dark, so a flash of the default theme would be a dark first frame. The default
// theme follows the system (`color-scheme: light dark`); a chosen one sets a single scheme.
test.use({ colorScheme: "dark" });

interface FirstFrame {
	scheme: string;
	fontSize: string;
	background: string;
	fontFamily: string;
}

/** Records <html> and <body>'s computed styles in the first animation frame, before first paint. */
async function recordFirstFrame(page: Page) {
	await page.addInitScript(() => {
		requestAnimationFrame(() => {
			const html = getComputedStyle(document.documentElement);
			const body = getComputedStyle(document.body);
			(window as unknown as { __firstFrame: FirstFrame }).__firstFrame = {
				scheme: html.colorScheme,
				fontSize: html.fontSize,
				background: body.backgroundColor,
				fontFamily: body.fontFamily,
			};
		});
	});
}

const firstFrame = (page: Page) =>
	page.evaluate(
		() => (window as unknown as { __firstFrame?: FirstFrame }).__firstFrame,
	);

const appearance = (page: Page) =>
	page.getByRole("region", { name: "Appearance" });

const bodyBackground = (page: Page) =>
	page.evaluate(() => getComputedStyle(document.body).backgroundColor);

// The default light and dark backgrounds, as computed styles report them.
const LIGHT_BACKGROUND = "oklch(0.985 0 0)";
const DARK_BACKGROUND = "oklch(0 0 0)";

test("theme, fonts and text size persist across reloads with no flash of the default theme", async ({
	page,
}) => {
	await recordFirstFrame(page);
	await page.goto("/settings");
	expect(await firstFrame(page)).toMatchObject({
		scheme: "light dark",
		fontSize: "16px",
		background: DARK_BACKGROUND,
	});

	const section = appearance(page);
	await section.getByRole("radio", { name: "Light", exact: true }).click();
	await section.getByLabel("Interface font").selectOption("inter");
	await section.getByLabel("Text size").focus();
	await page.keyboard.press("End");
	await expect(section.getByText("125%")).toBeVisible();
	await expect.poll(() => bodyBackground(page)).toBe(LIGHT_BACKGROUND);

	for (const path of ["/settings", "/new"]) {
		await page.goto(path);
		const frame = await firstFrame(page);
		expect(frame).toMatchObject({
			scheme: "light",
			fontSize: "20px",
			background: LIGHT_BACKGROUND,
		});
		expect(frame?.fontFamily).toMatch(/^"Inter Variable"/);
	}
	// The script removed itself, so React found the markup it rendered.
	await expect(page.locator("head script:not([src])")).toHaveCount(0);

	await page.goto("/settings");
	await appearance(page).getByRole("button", { name: "Reset all" }).click();
	await page.reload();
	expect(await firstFrame(page)).toMatchObject({
		scheme: "light dark",
		fontSize: "16px",
		background: DARK_BACKGROUND,
	});
});

test("a custom color applies, warns about contrast, and resets", async ({
	page,
}) => {
	await page.goto("/settings");
	const section = appearance(page);
	await section.getByRole("button", { name: "Advanced colors" }).click();
	await expect(
		section.getByRole("radio", { name: "Dark theme" }),
	).toBeChecked();

	await section.getByLabel(/^Page background/).fill("#203040");
	await expect.poll(() => bodyBackground(page)).toBe("rgb(32, 48, 64)");
	await page.reload();
	await expect.poll(() => bodyBackground(page)).toBe("rgb(32, 48, 64)");

	const advanced = appearance(page);
	await advanced.getByRole("button", { name: "Advanced colors" }).click();
	await expect(
		advanced.getByText("All text meets WCAG AA contrast"),
	).toBeVisible();
	await advanced.getByLabel(/^Text$/).fill("#2a3a4a");
	await expect(advanced.getByText("Some text is hard to read")).toBeVisible();

	await advanced.getByRole("button", { name: "Reset Page background" }).click();
	await advanced
		.getByRole("button", { name: "Reset Text", exact: true })
		.click();
	await expect.poll(() => bodyBackground(page)).toBe(DARK_BACKGROUND);
	await expect(
		advanced.getByText("All text meets WCAG AA contrast"),
	).toBeVisible();
});

test("a theme exports and imports as JSON", async ({ page }) => {
	await page.goto("/settings");
	const section = appearance(page);
	await section.getByRole("radio", { name: "Light", exact: true }).click();
	await section.getByLabel("Accent color").fill("#3366cc");

	const download = page.waitForEvent("download");
	await section.getByRole("button", { name: "Export theme" }).click();
	const file = await (await download).path();

	await section.getByRole("button", { name: "Reset all" }).click();
	await expect.poll(() => bodyBackground(page)).toBe(DARK_BACKGROUND);

	await section.getByLabel("Theme file to import").setInputFiles(file);
	await expect(section.getByText("Theme imported.")).toBeVisible();
	await expect.poll(() => bodyBackground(page)).toBe(LIGHT_BACKGROUND);
	await expect(page.locator("html")).toHaveCSS("--primary", "#3366cc");

	await section.getByLabel("Theme file to import").setInputFiles({
		name: "chats.json",
		mimeType: "application/json",
		buffer: Buffer.from(JSON.stringify({ chats: [] })),
	});
	await expect(section.getByRole("alert")).toContainText(
		"isn't a High Elo LLMs appearance file",
	);
});
