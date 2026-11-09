import { e2eMockModel, e2eMockReply } from "../src/lib/chat/e2e-model";
import { expect, test } from "./support/fixtures";
import { setUp } from "./support/workspaces";

// Roadmap 3.6: save a prompt, edit it (a new version), restore the old version from its history's diff
// view, apply it to a chat from Model settings, and find it all again after a reload. Replies come from
// the e2e mock model (hard rule 6).

test("save, edit, restore and apply a prompt, and keep it after a reload", async ({
	page,
	context,
}) => {
	await setUp(context, page, e2eMockModel("alpha"));
	await page.goto("/prompts");
	await expect(page.getByText("Save prompts you reuse.")).toBeVisible();

	// Save.
	await page.getByRole("button", { name: "New prompt" }).click();
	const form = page.getByRole("region", { name: "New prompt" });
	await form.getByLabel("Name").fill("Reviewer");
	await form.getByLabel("Tags").fill("Code, #tone");
	await form.getByLabel("Prompt").fill("Version one.");
	await form.getByRole("button", { name: "Save prompt" }).click();

	const detail = page.getByRole("article", { name: "Reviewer" });
	await expect(detail.getByLabel("Prompt")).toHaveValue("Version one.");
	await expect(detail.getByLabel("Tags")).toHaveValue("code, tone");

	// Edit: new text is a new version.
	await detail.getByLabel("Prompt").fill("Version two.");
	await detail.getByRole("button", { name: "Save", exact: true }).click();
	const versions = detail.getByRole("list", { name: "Versions" });
	await expect(versions.getByRole("button")).toHaveText([
		/Version 2 · current/,
		/Version 1/,
	]);

	// The diff from version 1 to now, then restore it.
	const diff = detail.getByRole("list", {
		name: "Changes from version 1 to the current version",
	});
	await expect(diff.locator("[data-diff=removed]")).toHaveText(/Version one\./);
	await expect(diff.locator("[data-diff=added]")).toHaveText(/Version two\./);
	await detail.getByRole("button", { name: "Restore version 1" }).click();
	await expect(versions.getByRole("button").first()).toHaveText(
		/Version 3 · current · restored from 1/,
	);
	await expect(detail.getByLabel("Prompt")).toHaveValue("Version one.");

	// Search by tag and text.
	const search = page.getByLabel("Search prompts");
	const saved = page.getByRole("list", { name: "Saved prompts" });
	await search.fill("#tone");
	await expect(saved.getByRole("button")).toHaveCount(1);
	await search.fill("#missing");
	await expect(saved.getByRole("button")).toHaveCount(0);
	await expect(page.getByText("No prompts match your search.")).toBeVisible();

	// Apply it to a new chat from Model settings, and send.
	await page.goto("/new");
	await page.getByRole("button", { name: "Model settings" }).click();
	const panel = page.getByRole("dialog", { name: "Model settings" });
	await panel.getByRole("button", { name: "Apply a saved prompt" }).click();
	await panel.getByLabel("Search saved prompts").fill("review");
	await panel.getByRole("button", { name: "Apply Reviewer" }).click();
	const chatPrompt = panel.getByLabel("System prompt for this chat");
	await expect(chatPrompt).toHaveValue("Version one.");
	await page.keyboard.press("Escape");
	await expect(panel).toBeHidden();
	const box = page.getByPlaceholder("Ask anything");
	await box.fill("Hello");
	await box.press("Enter");
	await expect(page.getByText(e2eMockReply("alpha"))).toBeVisible();
	await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);

	// After a reload, the chat keeps the applied prompt and the library keeps every version.
	await page.reload();
	await page.getByRole("button", { name: "Model settings" }).click();
	await expect(
		page
			.getByRole("dialog", { name: "Model settings" })
			.getByLabel("System prompt for this chat"),
	).toHaveValue("Version one.");
	await page.keyboard.press("Escape");

	await page.getByRole("link", { name: "Prompts" }).click();
	await expect(page).toHaveURL(/\/prompts$/);
	await page.getByRole("button", { name: /^Reviewer/ }).click();
	await expect(
		page
			.getByRole("article", { name: "Reviewer" })
			.getByRole("list", { name: "Versions" })
			.getByRole("button"),
	).toHaveCount(3);
});
