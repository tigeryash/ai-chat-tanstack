import type { Page } from "@playwright/test";
import { e2eMockModel } from "../src/lib/chat/e2e-model";
import { expect, test } from "./support/fixtures";
import { settingsDialog } from "./support/settings";
import {
	composer,
	openWorkspace,
	pane,
	panes,
	setUp,
} from "./support/workspaces";

// Roadmap R2 S6: every shortcut in src/lib/commands/keymap.ts, pressed once with the macOS keymap (⌘,
// Ctrl+1–4) and once with the Linux one (Ctrl, Alt+1–4), picked by faking `navigator.platform`. None
// fires while typing in a field, except Cmd+K, Cmd+, and Shift+Esc.

const KEYMAPS = [
	{ name: "macOS", platform: "MacIntel", mod: "Meta", paneMod: "Control" },
	{ name: "Linux", platform: "Linux x86_64", mod: "Control", paneMod: "Alt" },
] as const;

const sheet = (page: Page) =>
	page.getByRole("dialog", { name: "Keyboard shortcuts" });
const palette = (page: Page) =>
	page.getByRole("dialog", { name: "Command palette" });
const sidebarState = (page: Page) =>
	page.locator("[data-slot=sidebar][data-state]");

for (const keymap of KEYMAPS) {
	test.describe(`${keymap.name} keymap`, () => {
		const { mod, paneMod } = keymap;

		test.beforeEach(async ({ page, context }) => {
			await page.addInitScript((platform) => {
				Object.defineProperty(Navigator.prototype, "platform", {
					get: () => platform,
				});
			}, keymap.platform);
			await setUp(context, page, e2eMockModel("alpha"));
		});

		test("each app shortcut runs once outside a field", async ({ page }) => {
			await page.goto("/prompts");
			await expect(
				page.getByRole("heading", { name: "Prompts", level: 1 }),
			).toBeVisible();

			// Cmd+/ and ? open the sheet; it lists the keys for this platform.
			await page.keyboard.press(`${mod}+Slash`);
			await expect(sheet(page)).toBeVisible();
			await expect(
				sheet(page).locator("[data-shortcut=new-chat] kbd").first(),
			).toHaveAttribute("aria-label", mod === "Meta" ? "⌘⇧O" : "Ctrl+Shift+O");
			await expect(
				sheet(page).locator("[data-shortcut=focus-pane] kbd").first(),
			).toHaveAttribute("aria-label", mod === "Meta" ? "⌃1–4" : "Alt+1–4");
			await page.keyboard.press(`${mod}+Slash`);
			await expect(sheet(page)).toHaveCount(0);
			await page.keyboard.press("Shift+Slash");
			await expect(sheet(page)).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(sheet(page)).toHaveCount(0);

			// Cmd+B toggles the sidebar.
			await expect(sidebarState(page)).toHaveAttribute(
				"data-state",
				"expanded",
			);
			await page.keyboard.press(`${mod}+b`);
			await expect(sidebarState(page)).toHaveAttribute(
				"data-state",
				"collapsed",
			);
			await page.keyboard.press(`${mod}+b`);
			await expect(sidebarState(page)).toHaveAttribute(
				"data-state",
				"expanded",
			);

			// Cmd+K opens the palette.
			await page.keyboard.press(`${mod}+K`);
			await expect(palette(page)).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(palette(page)).toHaveCount(0);

			// Cmd+, opens Settings, whose Keyboard section lists the same shortcuts.
			await page.keyboard.press(`${mod}+Comma`);
			await expect(settingsDialog(page)).toBeVisible();
			await settingsDialog(page)
				.getByRole("navigation", { name: "Settings sections" })
				.getByRole("button", { name: "Keyboard", exact: true })
				.click();
			await expect(
				settingsDialog(page).locator('[data-shortcut="pane.add"]'),
			).toContainText("Add a pane");
			await page.keyboard.press("Escape");
			await expect(settingsDialog(page)).toHaveCount(0);

			// Cmd+Shift+O starts a new chat.
			await page.keyboard.press(`${mod}+Shift+O`);
			await expect(page).toHaveURL(/\/new$/);
		});

		test("pane shortcuts act on the focused pane", async ({ page }) => {
			await openWorkspace(page, 2);
			// Ctrl+2 (Alt+2 off a Mac) focuses pane 2.
			await page.keyboard.press(`${paneMod}+2`);
			await expect(pane(page, 2)).toBeFocused();

			// Cmd+\ adds a pane to its right.
			const second = await pane(page, 2).getAttribute("data-pane-id");
			await page.keyboard.press(`${mod}+Backslash`);
			await expect(panes(page)).toHaveCount(3);
			await expect(panes(page).nth(1)).toHaveAttribute(
				"data-pane-id",
				second ?? "",
			);
			const added = await panes(page).nth(2).getAttribute("data-pane-id");

			// Cmd+Shift+\ removes the focused pane.
			await page.keyboard.press(`${paneMod}+3`);
			await expect(pane(page, 3)).toBeFocused();
			await page.keyboard.press(`${mod}+Shift+Backslash`);
			await expect(panes(page)).toHaveCount(2);
			await expect(page.locator(`[data-pane-id="${added}"]`)).toHaveCount(0);

			// Cmd+Shift+M opens the palette's "Switch model" page for the focused pane (R2 S7's command).
			await page.keyboard.press(`${paneMod}+1`);
			await expect(pane(page, 1)).toBeFocused();
			await page.keyboard.press(`${mod}+Shift+M`);
			await expect(
				palette(page).getByRole("combobox", { name: "Search: Switch model" }),
			).toBeFocused();
			// Esc goes back a page, then closes.
			await page.keyboard.press("Escape");
			await expect(
				palette(page).getByRole("combobox", {
					name: "Search commands, chats and settings",
				}),
			).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(palette(page)).toHaveCount(0);

			// The palette's pane rows show the same keys.
			await page.keyboard.press(`${mod}+K`);
			await page.keyboard.type("add pane");
			await expect(
				palette(page)
					.getByRole("option", { name: /^Add pane/ })
					.locator("kbd"),
			).toHaveAttribute("aria-label", mod === "Meta" ? "⌘\\" : "Ctrl+\\");
			await page.keyboard.press("Escape");
			await expect(palette(page)).toHaveCount(0);

			// Shift+Esc puts the cursor in the focused pane's message box.
			await page.keyboard.press(`${paneMod}+2`);
			await page.keyboard.press("Shift+Escape");
			await expect(composer(pane(page, 2))).toBeFocused();
		});

		test("keys with a modifier work while typing; ? and AltGr don't", async ({
			page,
		}) => {
			await openWorkspace(page, 2);
			const box = composer(pane(page, 1));
			await box.click();

			// Plain keys type: ? goes into the box and opens nothing. AltGr (Ctrl+Alt) types too.
			await page.keyboard.press("Shift+Slash");
			await page.keyboard.press("Control+Alt+2");
			await expect(box).toBeFocused();
			await expect(box).toHaveValue("?");
			await expect(sheet(page)).toHaveCount(0);

			// Keys with ⌘, Ctrl or Alt type nothing, so they run from the box.
			await page.keyboard.press(`${paneMod}+2`);
			await expect(pane(page, 2)).toBeFocused();
			await page.keyboard.press("Shift+Escape");
			const second = composer(pane(page, 2));
			await expect(second).toBeFocused();
			await page.keyboard.press(`${mod}+Backslash`);
			await expect(panes(page)).toHaveCount(3);
			await second.click();
			await page.keyboard.press(`${mod}+Shift+Backslash`);
			await expect(panes(page)).toHaveCount(2);
			await composer(pane(page, 1)).click();
			await page.keyboard.press(`${mod}+b`);
			await expect(sidebarState(page)).toHaveAttribute(
				"data-state",
				"collapsed",
			);
			await page.keyboard.press(`${mod}+Slash`);
			await expect(sheet(page)).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(sheet(page)).toHaveCount(0);
			await page.keyboard.press(`${mod}+K`);
			await expect(palette(page)).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(composer(pane(page, 1))).toBeFocused();
			await page.keyboard.press(`${mod}+Comma`);
			await expect(settingsDialog(page)).toBeVisible();
			await page.keyboard.press("Escape");
			await composer(pane(page, 1)).click();
			await page.keyboard.press(`${mod}+Shift+O`);
			await expect(page).toHaveURL(/\/new$/);
		});
	});
}
