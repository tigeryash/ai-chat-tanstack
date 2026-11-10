import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import {
	connectOpenRouter,
	fakeOpenRouter,
	PNG,
	pickModel,
} from "./support/openrouter";

// Roadmap 1.10: Settings → Your data. A chat with an image attachment and a saved prompt are exported
// from Settings, site data is cleared, and importing the file brings both back. The saved OpenRouter key
// is never in the file (hard rule 1). Refine R4 adds a workspace and a saved layout to the same round trip.

const OPUS = "anthropic/claude-opus-5.5";
const DEEPSEEK = "deepseek/deepseek-v4.1-flash";
const WORKSPACE_URL = /\/w\/[0-9a-f-]{36}(\?.*)?$/;

const pane = (page: Page, n: number) =>
	page.getByRole("region", { name: `Pane ${n}`, exact: true });

async function expectPaneModels(page: Page, names: readonly string[]) {
	await expect(page.locator("section[data-pane-id]")).toHaveCount(names.length);
	for (const [index, name] of names.entries()) {
		await expect(
			pane(page, index + 1).getByRole("button", { name: /^Model: / }),
		).toContainText(name);
	}
}

async function clearSiteData(page: Page) {
	// A page without the chat database open, so nothing blocks the delete.
	await page.goto("/privacy");
	await page.evaluate(async () => {
		localStorage.clear();
		sessionStorage.clear();
		const databases = await indexedDB.databases();
		await Promise.all(
			databases.map(
				({ name }) =>
					new Promise<void>((resolve, reject) => {
						if (!name) return resolve();
						const request = indexedDB.deleteDatabase(name);
						request.onsuccess = () => resolve();
						request.onerror = () => reject(request.error);
						request.onblocked = () => reject(new Error(`${name} blocked`));
					}),
			),
		);
	});
}

test("export from Settings, clear site data, import: the chat, its image and the saved prompt are back", async ({
	page,
}) => {
	// A chat, a prompt, an export, a wipe and two imports: longer than one flow's default budget.
	test.slow();
	await fakeOpenRouter(page);
	await connectOpenRouter(page);

	// A chat with an image.
	await page.goto("/new");
	await pickModel(page, "Opus", "anthropic/claude-opus-5.5");
	await page
		.locator("input[type=file]")
		.setInputFiles({ name: "red.png", mimeType: "image/png", buffer: PNG });
	const box = page.getByPlaceholder("Ask anything");
	await box.fill("Export me");
	await box.press("Enter");
	await expect(page.getByText("A red square.")).toBeVisible();
	await expect(page).toHaveURL(/\/(?!new)[^/]+$/);
	const chatUrl = page.url();

	// A saved prompt.
	await page.goto("/prompts");
	await page.getByRole("button", { name: "New prompt" }).click();
	const form = page.getByRole("region", { name: "New prompt" });
	await form.getByLabel("Name").fill("Exported prompt");
	await form.getByLabel("Prompt").fill("Answer in one line.");
	await form.getByRole("button", { name: "Save prompt" }).click();
	await expect(
		page.getByRole("article", { name: "Exported prompt" }),
	).toBeVisible();

	// Export.
	await page.goto("/new?settings=data");
	const data = page.getByRole("region", { name: "Your data" });
	const downloading = page.waitForEvent("download");
	await data.getByRole("button", { name: "Export data" }).click();
	const download = await downloading;
	expect(download.suggestedFilename()).toMatch(
		/^high-elo-llms-export-\d{4}-\d{2}-\d{2}\.json$/,
	);
	await expect(data.getByRole("status")).toHaveText(
		"Exported 1 chat and 1 saved prompt.",
	);
	const path = await download.path();
	const file = await readFile(path, "utf8");
	expect(file).toContain("Answer in one line.");
	expect(file).toContain("data:image/png;base64,");
	expect(file).not.toContain("sk-or-v1");

	// Clear site data: the chat is gone.
	await clearSiteData(page);
	await page.goto(chatUrl);
	await expect(page.getByText("A red square.")).toHaveCount(0);

	// Import.
	await page.goto("/new?settings=data");
	await data.getByLabel("Export file to import").setInputFiles(path);
	await expect(data.getByRole("status")).toHaveText(
		"Chats: 1 added, 0 updated, 0 already up to date. Saved prompts: 1 added, 0 updated, 0 already up to date. Workspaces: 0 added, 0 updated, 0 already up to date. Saved layouts: 0 added, 0 updated, 0 already up to date.",
	);

	// The chat and its image are back, from the sidebar.
	await page.keyboard.press("Escape");
	await page.getByRole("link", { name: "Export me" }).click();
	await expect(page.getByText("A red square.")).toBeVisible();
	const image = page.getByRole("img", { name: "red.png" });
	await expect(image).toBeVisible();
	expect(
		await image.evaluate((img: HTMLImageElement) => img.naturalWidth),
	).toBe(4);

	// The saved prompt is back.
	await page.goto("/prompts");
	await page.getByRole("button", { name: /^Exported prompt/ }).click();
	await expect(
		page.getByRole("article", { name: "Exported prompt" }).getByLabel("Prompt"),
	).toHaveValue("Answer in one line.");

	// Importing the same file again changes nothing.
	await page.goto("/new?settings=data");
	await data.getByLabel("Export file to import").setInputFiles(path);
	await expect(data.getByRole("status")).toHaveText(
		"Chats: 0 added, 0 updated, 1 already up to date. Saved prompts: 0 added, 0 updated, 1 already up to date. Workspaces: 0 added, 0 updated, 0 already up to date. Saved layouts: 0 added, 0 updated, 0 already up to date.",
	);
});

test("export, clear site data, import: the workspace and the saved layout are back with their panes", async ({
	page,
}) => {
	// Refine R4: workspaces and layouts in the same file.
	test.slow();
	await fakeOpenRouter(page);
	await connectOpenRouter(page);

	// A two-pane workspace, sent to from the synced composer, and its layout saved.
	await page.goto(`/new?models=${OPUS},${DEEPSEEK}`);
	await expect(page).toHaveURL(WORKSPACE_URL);
	await expectPaneModels(page, ["Opus", "DeepSeek"]);
	const box = pane(page, 1).getByPlaceholder("Ask anything");
	await box.fill("Compare me");
	await box.press("Enter");
	for (const n of [1, 2]) {
		await expect(pane(page, n).getByText("A red square.")).toBeVisible();
	}
	const workspaceUrl = page.url();
	await page.getByRole("button", { name: "Layouts" }).click();
	const menu = page.getByRole("dialog", { name: "Layouts" });
	await menu.getByLabel("Save this layout").fill("Exported layout");
	await menu.getByRole("button", { name: "Save", exact: true }).click();
	await expect(menu.getByText("Saved “Exported layout”.")).toBeVisible();
	await page.keyboard.press("Escape");

	// Export, wipe, import.
	await page.goto("/settings");
	const data = page.getByRole("region", { name: "Your data" });
	const downloading = page.waitForEvent("download");
	await data.getByRole("button", { name: "Export data" }).click();
	const path = await (await downloading).path();
	await expect(data.getByRole("status")).toHaveText(
		"Exported 2 chats and 0 saved prompts.",
	);
	const file = JSON.parse(await readFile(path, "utf8"));
	expect(file.workspaces).toHaveLength(1);
	expect(file.layouts).toHaveLength(1);

	await clearSiteData(page);
	await page.goto("/settings");
	await data.getByLabel("Export file to import").setInputFiles(path);
	await expect(data.getByRole("status")).toHaveText(
		"Chats: 2 added, 0 updated, 0 already up to date. Saved prompts: 0 added, 0 updated, 0 already up to date. Workspaces: 1 added, 0 updated, 0 already up to date. Saved layouts: 1 added, 0 updated, 0 already up to date.",
	);

	// The workspace opens with both panes, their replies and models.
	await page.goto(workspaceUrl);
	await expectPaneModels(page, ["Opus", "DeepSeek"]);
	for (const n of [1, 2]) {
		await expect(pane(page, n).getByText("A red square.")).toBeVisible();
	}

	// The saved layout opens a new workspace with the same panes.
	await page.goto("/new");
	await page.getByRole("button", { name: "Layouts" }).click();
	await page
		.getByRole("dialog", { name: "Layouts" })
		.getByRole("button", { name: "Open Exported layout" })
		.click();
	await expect(page).toHaveURL(WORKSPACE_URL);
	expect(page.url()).not.toBe(workspaceUrl);
	await expectPaneModels(page, ["Opus", "DeepSeek"]);
});

test("importing a file that isn't an export shows a friendly error", async ({
	page,
}) => {
	await page.goto("/new?settings=data");
	const data = page.getByRole("region", { name: "Your data" });
	await data.getByLabel("Export file to import").setInputFiles({
		name: "notes.json",
		mimeType: "application/json",
		buffer: Buffer.from('{"hello": "world"}'),
	});
	await expect(data.getByRole("alert")).toHaveText(
		"That file isn't a High Elo LLMs export, or it's damaged. Nothing was changed.",
	);
});
