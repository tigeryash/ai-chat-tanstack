import type { Locator, Page } from "@playwright/test";
import {
	E2E_SLOW_MODEL,
	e2eMockModel,
	e2eMockReply,
} from "../src/lib/chat/e2e-model";
import { expect, test } from "./support/fixtures";
import {
	composer,
	openWorkspace,
	pane,
	panes,
	setUp,
	status,
} from "./support/workspaces";

// Roadmap R2 S7: the palette's pane actions, on the focused pane (the last one clicked, else pane 1) of a
// two-pane workspace. Replies come from the e2e mock models a stubbed local server lists (hard rule 6).

const palette = (page: Page) =>
	page.getByRole("dialog", { name: "Command palette" });
const search = (page: Page) => palette(page).getByRole("combobox");
const option = (page: Page, name: string | RegExp) =>
	palette(page)
		.getByRole("listbox", { name: "Results" })
		.getByRole("option", { name });
const modelButton = (scope: Locator | Page) =>
	scope.getByRole("button", { name: /^Model: / });

async function openPalette(page: Page) {
	await page.keyboard.press("ControlOrMeta+K");
	await expect(search(page)).toBeFocused();
}

/** Opens the palette, finds `title` and runs it with Enter. */
async function run(page: Page, query: string, title: string | RegExp) {
	await openPalette(page);
	await search(page).fill(query);
	await expect(option(page, title)).toHaveAttribute("aria-selected", "true");
	await page.keyboard.press("Enter");
}

/** Saves a prompt on the Prompts page. */
async function savePrompt(page: Page, name: string, text: string) {
	await page.goto("/prompts");
	await page.getByRole("button", { name: "New prompt" }).click();
	const form = page.getByRole("region", { name: "New prompt" });
	await form.getByLabel("Name").fill(name);
	await form.getByLabel("Prompt").fill(text);
	await form.getByRole("button", { name: "Save prompt" }).click();
	await expect(page.getByRole("article", { name })).toBeVisible();
}

/** The pane's own system prompt, read from its Model settings sheet (opened from the palette). */
async function systemPromptOf(page: Page, n: number) {
	await composer(pane(page, n)).click();
	await run(page, "model settings", "Open model settings");
	const sheet = page.getByRole("dialog", { name: "Model settings" });
	await expect(sheet).toBeVisible();
	const value = await sheet
		.getByLabel("System prompt for this chat")
		.inputValue();
	await page.keyboard.press("Escape");
	await expect(sheet).toHaveCount(0);
	return value;
}

test("the focused pane's actions: model page, sync, prompts, settings, copy, regenerate, add and remove", async ({
	page,
	context,
}) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await setUp(context, page, e2eMockModel("alpha"));
	await savePrompt(page, "Reviewer", "Review like a senior engineer.");
	await savePrompt(page, "Pirate", "Answer like a pirate.");
	await openWorkspace(page, 2);

	// Pane 1 is focused until another is used; the actions name it.
	await openPalette(page);
	await search(page).fill(">");
	await expect(option(page, /^Switch model….*Pane 1/)).toBeVisible();
	await page.keyboard.press("Escape");

	// Switch model, a nested page, on pane 2 (clicked last). Backspace on an empty query and Esc go back.
	await composer(pane(page, 2)).click();
	await run(page, "switch model", /^Switch model…/);
	await expect(search(page)).toHaveAccessibleName("Search: Switch model");
	await expect(option(page, e2eMockModel("beta"))).toBeVisible();
	await page.keyboard.press("Backspace");
	await expect(search(page)).toHaveAccessibleName(
		"Search commands, chats and settings",
	);
	await search(page).fill("switch model");
	await page.keyboard.press("Enter");
	await expect(search(page)).toHaveAccessibleName("Search: Switch model");
	await page.keyboard.press("Escape");
	await expect(search(page)).toHaveAccessibleName(
		"Search commands, chats and settings",
	);
	await search(page).fill("switch model");
	await page.keyboard.press("Enter");
	await search(page).fill("beta");
	await expect(option(page, e2eMockModel("beta"))).toHaveAttribute(
		"aria-selected",
		"true",
	);
	await page.keyboard.press("Enter");
	await expect(palette(page)).toHaveCount(0);
	await expect(modelButton(pane(page, 2))).toContainText(e2eMockModel("beta"));
	await expect(modelButton(pane(page, 1))).toContainText(e2eMockModel("alpha"));
	// Focus went back to pane 2's composer.
	await expect(composer(pane(page, 2))).toBeFocused();

	// Apply a prompt to pane 2 only, then one to every synced pane.
	await run(page, "apply saved prompt", /^Apply saved prompt….*Pane 2/);
	await expect(search(page)).toHaveAccessibleName("Search: Apply prompt");
	await search(page).fill("review");
	await page.keyboard.press("Enter");
	await expect(palette(page)).toHaveCount(0);
	expect(await systemPromptOf(page, 2)).toBe("Review like a senior engineer.");
	expect(await systemPromptOf(page, 1)).toBe("");
	await run(page, "synced panes", /^Apply saved prompt to synced panes…/);
	await search(page).fill("pirate");
	await page.keyboard.press("Enter");
	expect(await systemPromptOf(page, 1)).toBe("Answer like a pirate.");
	expect(await systemPromptOf(page, 2)).toBe("Answer like a pirate.");

	// Send to both, then copy and regenerate pane 2's reply.
	await composer(pane(page, 1)).fill("Compare these");
	await composer(pane(page, 1)).press("Enter");
	for (const [n, name] of [
		[1, "alpha"],
		[2, "beta"],
	] as const) {
		await expect(pane(page, n).getByText(e2eMockReply(name))).toBeVisible();
		await expect(status(pane(page, n))).toHaveAttribute(
			"data-chat-status",
			"ready",
		);
	}
	await composer(pane(page, 2)).click();
	await run(page, "copy last reply", /^Copy last reply/);
	await expect
		.poll(() => page.evaluate(() => navigator.clipboard.readText()))
		.toBe(e2eMockReply("beta"));
	await run(page, "regenerate", /^Regenerate last reply/);
	await expect(
		pane(page, 2).locator("[data-slot='message-versions']"),
	).toHaveText("2/2");
	await expect(status(pane(page, 2))).toHaveAttribute(
		"data-chat-status",
		"ready",
	);
	await expect(
		pane(page, 1).locator("[data-slot='message-versions']"),
	).toHaveCount(0);

	// Sync is a toggle: it flips without closing the palette.
	await openPalette(page);
	await search(page).fill("sync pane");
	const sync = option(page, /^Sync pane/);
	await expect(sync).toHaveAttribute("aria-checked", "true");
	await sync.click();
	await expect(sync).toHaveAttribute("aria-checked", "false");
	await expect(search(page)).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(
		pane(page, 2).getByRole("switch", { name: "Sync Pane 2" }),
	).not.toBeChecked();
	await expect(
		pane(page, 1).getByRole("switch", { name: "Sync Pane 1" }),
	).toBeChecked();

	// Add a pane, then remove the focused one.
	await run(page, "add pane", /^Add pane/);
	await expect(panes(page)).toHaveCount(3);
	await composer(pane(page, 3)).click();
	await run(page, "remove pane", /^Remove pane.*Pane 3/);
	await expect(panes(page)).toHaveCount(2);
	await expect(modelButton(pane(page, 2))).toContainText(e2eMockModel("beta"));
});

test("Stop all stops every replying pane, synced or not; Switch theme is a page", async ({
	page,
	context,
}) => {
	await setUp(context, page, E2E_SLOW_MODEL);
	await openWorkspace(page, 2);
	await pane(page, 2).getByRole("switch", { name: "Sync Pane 2" }).click();
	await composer(pane(page, 2)).fill("On my own");
	await composer(pane(page, 2)).press("Enter");
	await composer(pane(page, 1)).fill("Mine too");
	await composer(pane(page, 1)).press("Enter");
	for (const n of [1, 2]) {
		await expect(status(pane(page, n))).toHaveAttribute(
			"data-chat-status",
			"streaming",
		);
	}
	await run(page, "stop all", "Stop all replies");
	for (const n of [1, 2]) {
		await expect(status(pane(page, n))).toHaveAttribute(
			"data-chat-status",
			"ready",
		);
	}
	// Nothing is replying now, so it isn't offered.
	await openPalette(page);
	await search(page).fill("stop all");
	await expect(option(page, "Stop all replies")).toHaveCount(0);

	await search(page).fill("switch theme");
	await page.keyboard.press("Enter");
	await expect(search(page)).toHaveAccessibleName("Search: Switch theme");
	await expect(
		palette(page).getByRole("listbox").getByRole("option"),
	).toHaveText([/Theme: System/, /Theme: Light/, /Theme: Dark/]);
	await option(page, "Theme: Dark").click();
	await expect(page.locator("html")).toHaveClass("dark");
	await expect(option(page, "Theme: Dark")).toHaveAttribute(
		"aria-checked",
		"true",
	);
});

// Switch host needs a catalog model two connected hosts serve: the seeded catalog's DeepSeek V4.1 Flash
// on OpenRouter and Fireworks, with fake keys (nothing is sent: the test never sends).
test("Switch model and Switch host pick a catalog model and pin its host", async ({
	page,
}) => {
	for (const [provider, key] of [
		["OpenRouter", "sk-or-v1-e2eFakeHostKey0123456789aaaa"],
		["Fireworks", "fw-e2eFakeHostKey0123456789bbbb"],
	] as const) {
		await page.goto("/e2e/keys");
		const row = page.getByRole("region", { name: provider, exact: true });
		await row.getByRole("button", { name: "Add key" }).click();
		await row.getByLabel(`${provider} API key`).fill(key);
		await row.getByRole("radio", { name: "Remember on this device" }).check();
		await row.getByRole("button", { name: "Save key" }).click();
		await expect(row).toContainText(`••••${key.slice(-4)}`);
	}
	await page.goto("/new");
	await expect(modelButton(page)).toBeVisible();

	await run(page, "switch model", /^Switch model…/);
	await search(page).fill("deepseek v4.1 flash");
	await expect(option(page, /^DeepSeek V4\.1 Flash/)).toHaveAttribute(
		"aria-selected",
		"true",
	);
	await page.keyboard.press("Enter");
	await expect(modelButton(page)).toContainText("DeepSeek V4.1 Flash");
	await expect(
		page.getByRole("button", { name: /^Host: via OpenRouter.*\(Auto\)/ }),
	).toBeVisible();

	await run(page, "switch host", /^Switch host…/);
	await expect(search(page)).toHaveAccessibleName("Search: Switch host");
	await expect(
		palette(page).getByRole("listbox").getByRole("option"),
	).toHaveText([/^Auto \(best connected host\)/, /^OpenRouter/, /^Fireworks/]);
	await search(page).fill("fireworks");
	await page.keyboard.press("Enter");
	await expect(
		page.getByRole("button", { name: "Host: via Fireworks" }),
	).toBeVisible();
});
