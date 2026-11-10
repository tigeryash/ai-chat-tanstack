import type { Page } from "@playwright/test";
import { SETTINGS } from "../src/lib/settings/registry";
import { expect, test } from "./support/fixtures";
import { settingsDialog, showSettingsSection } from "./support/settings";

// Roadmap R2 S1: Settings is a dialog over any page, opened by `?settings=<section>`, Cmd+, and the
// sidebar. Every existing control is a row of the settings registry, reachable by nav and by search.

const SECTION_LABELS: Record<string, string> = {
	connections: "Connections",
	appearance: "Appearance",
	notifications: "Notifications",
	data: "Your data",
	privacy: "Privacy",
};

const composer = (page: Page) => page.getByPlaceholder("Ask anything");
const search = (page: Page) =>
	settingsDialog(page).getByRole("searchbox", { name: "Search settings" });
const breadcrumb = (page: Page) =>
	settingsDialog(page).getByRole("heading", { name: /^Settings/ });

test("Cmd+, opens Settings from the composer, and Esc closes it and returns focus", async ({
	page,
}) => {
	await page.goto("/new");
	await composer(page).click();
	await expect(composer(page)).toBeFocused();

	await page.keyboard.press("ControlOrMeta+Comma");
	await expect(settingsDialog(page)).toBeVisible();
	await expect(breadcrumb(page)).toHaveText("Settings/General");
	await expect(page).toHaveURL(/\/new\?settings=general$/);
	await expect(search(page)).toBeFocused();

	await page.keyboard.press("Escape");
	await expect(settingsDialog(page)).toHaveCount(0);
	await expect(page).toHaveURL(/\/new$/);
	await expect(composer(page)).toBeFocused();
});

test("a deep link opens a section, and Back closes the dialog, not the section", async ({
	page,
}) => {
	await page.goto("/new");
	await page.getByRole("link", { name: "Settings" }).click();
	await expect(breadcrumb(page)).toHaveText("Settings/General");
	await showSettingsSection(page, "Appearance");
	await expect(page).toHaveURL(/\?settings=appearance$/);
	await showSettingsSection(page, "Privacy");

	await page.goBack();
	await expect(settingsDialog(page)).toHaveCount(0);
	await expect(page).toHaveURL(/\/new$/);

	await page.goto("/new?settings=appearance");
	await expect(breadcrumb(page)).toHaveText("Settings/Appearance");
	await expect(
		page.getByRole("region", { name: "Appearance" }).getByRole("radio", {
			name: "Dark",
			exact: true,
		}),
	).toBeVisible();

	// An unknown section opens General.
	await page.goto("/new?settings=nope");
	await expect(breadcrumb(page)).toHaveText("Settings/General");
	await expect(settingsDialog(page)).toContainText("Nothing to set here yet");
});

test("the close button returns focus to the sidebar link, and focus stays in the dialog", async ({
	page,
}) => {
	await page.goto("/new");
	const link = page.getByRole("link", { name: "Settings" });
	await link.click();
	await expect(settingsDialog(page)).toBeVisible();

	for (let i = 0; i < 25; i++) await page.keyboard.press("Tab");
	expect(
		await settingsDialog(page).evaluate((dialog) =>
			dialog.contains(document.activeElement),
		),
	).toBe(true);

	await settingsDialog(page)
		.getByRole("button", { name: "Close settings" })
		.click();
	await expect(settingsDialog(page)).toHaveCount(0);
	await expect(link).toBeFocused();
	await expect(page).toHaveURL(/\/new$/);
});

test("old /settings links land on their section", async ({ page }) => {
	await page.goto("/settings");
	await expect(page).toHaveURL(/\/new\?settings=connections$/);
	await expect(breadcrumb(page)).toHaveText("Settings/Connections");

	await page.goto("/settings#your-data");
	await expect(page).toHaveURL(/\/new\?settings=data$/);
	await expect(page.getByRole("region", { name: "Your data" })).toBeVisible();

	// Closing it leaves the page it opened over.
	await page.keyboard.press("Escape");
	await expect(page).toHaveURL(/\/new$/);
	await expect(composer(page)).toBeVisible();
});

test("a quick second section switch wins over the first", async ({ page }) => {
	await page.goto("/new?settings=connections");
	await expect(breadcrumb(page)).toHaveText("Settings/Connections");
	const nav = settingsDialog(page).getByRole("navigation", {
		name: "Settings sections",
	});
	// Both clicks land before the first switch's navigation finishes.
	await nav.evaluate((element) => {
		const button = (name: string) =>
			[...element.querySelectorAll("button")].find(
				(b) => b.textContent === name,
			);
		button("Privacy")?.click();
		button("Connections")?.click();
	});
	await expect(breadcrumb(page)).toHaveText("Settings/Connections");
	await expect(page).toHaveURL(/\?settings=connections$/);
	await page.waitForTimeout(500);
	await expect(breadcrumb(page)).toHaveText("Settings/Connections");
	await expect(
		page.getByRole("region", { name: "Local models" }).getByRole("button", {
			name: "Add local server",
		}),
	).toBeVisible();
});

test("every setting is reachable from the nav", async ({ page }) => {
	await page.goto("/new?settings=general");
	for (const [section, label] of Object.entries(SECTION_LABELS)) {
		await showSettingsSection(page, label);
		await expect(breadcrumb(page)).toHaveText(`Settings/${label}`);
		for (const setting of SETTINGS.filter((s) => s.section === section)) {
			const row = page.locator(`#setting-${setting.id}`);
			await expect(row).toBeVisible();
			await expect(row).toContainText(setting.label);
		}
	}
	// One control of each kind works where it landed.
	await showSettingsSection(page, "Notifications");
	await expect(
		page.getByRole("switch", { name: "Show reply status in the tab title" }),
	).toBeChecked();
	await showSettingsSection(page, "Connections");
	await expect(
		page.getByRole("region", { name: "OpenRouter", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Connect OpenRouter" }),
	).toBeVisible();
});

test("every setting is reachable by search, which jumps to its row and highlights it", async ({
	page,
}) => {
	await page.goto("/new?settings=general");
	for (const setting of SETTINGS) {
		await search(page).fill(setting.label);
		await settingsDialog(page)
			.getByRole("list", { name: "Search results" })
			.getByRole("button", { name: new RegExp(`^${setting.label}`) })
			.first()
			.click();
		const row = page.locator(`#setting-${setting.id}`);
		await expect(row).toBeFocused();
		await expect(row).toHaveAttribute("data-highlighted", "true");
		await expect(row).toBeInViewport();
		await expect(breadcrumb(page)).toHaveText(
			`Settings/${SECTION_LABELS[setting.section]}`,
		);
	}
});

test("search finds keywords, says when nothing matches, and Esc clears it first", async ({
	page,
}) => {
	await page.goto("/new?settings=general");
	await search(page).fill("ollama");
	await search(page).press("Enter");
	await expect(page.locator("#setting-local-endpoints")).toBeFocused();
	await expect(breadcrumb(page)).toHaveText("Settings/Connections");

	await search(page).fill("quantum teleport");
	await expect(settingsDialog(page).getByRole("status")).toHaveText(
		"No settings match “quantum teleport”.",
	);

	await search(page).press("Escape");
	await expect(search(page)).toHaveValue("");
	await expect(settingsDialog(page)).toBeVisible();
	await expect(
		settingsDialog(page).getByRole("navigation", { name: "Settings sections" }),
	).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(settingsDialog(page)).toHaveCount(0);
});

test("the page behind doesn't scroll, the section does", async ({ page }) => {
	await page.goto("/new?settings=appearance");
	const section = page.getByRole("region", { name: "Appearance" });
	await section.hover();
	await page.mouse.wheel(0, 2000);
	await expect
		.poll(() => section.evaluate((el) => el.scrollTop))
		.toBeGreaterThan(0);
	expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test.describe("on a phone", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("Settings is a full-screen sheet: the list, then one section", async ({
		page,
	}) => {
		await page.goto("/new?settings=general");
		const dialog = settingsDialog(page);
		const box = await dialog.boundingBox();
		expect(box).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });

		const nav = dialog.getByRole("navigation", { name: "Settings sections" });
		await expect(nav).toBeVisible();
		await nav.getByRole("button", { name: "Appearance" }).click();
		await expect(nav).toBeHidden();
		await expect(
			page.getByRole("region", { name: "Appearance" }).getByRole("radio", {
				name: "Light",
				exact: true,
			}),
		).toBeVisible();

		await dialog.getByRole("button", { name: "All settings" }).click();
		await expect(nav).toBeVisible();

		// A link to a section opens that section.
		await page.goto("/new?settings=privacy");
		await expect(
			page.getByRole("switch", { name: "Share anonymous usage analytics" }),
		).toBeVisible();
		await expect(nav).toBeHidden();
	});
});
