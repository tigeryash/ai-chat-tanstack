import { e2eMockModel, e2eMockReply } from "../src/lib/chat/e2e-model";
import { expect, test } from "./support/fixtures";
import { setUp } from "./support/workspaces";

// Roadmap 3.6b: make a saved prompt a model's default from Model settings, start a new chat with that
// model and see the default applied, send, and find the prompt version in the reply's details, also
// after a reload, with a link to that version on the prompts page. Replies come from the e2e mock
// model (hard rule 6).

test("a model's default prompt applies to new chats and replies record its version", async ({
	page,
	context,
}) => {
	await setUp(context, page, e2eMockModel("alpha"));

	// A saved prompt with two versions.
	await page.goto("/prompts");
	await page.getByRole("button", { name: "New prompt" }).click();
	const form = page.getByRole("region", { name: "New prompt" });
	await form.getByLabel("Name").fill("Reviewer");
	await form.getByLabel("Prompt").fill("Version one.");
	await form.getByRole("button", { name: "Save prompt" }).click();
	const detail = page.getByRole("article", { name: "Reviewer" });
	await detail.getByLabel("Prompt").fill("Version two.");
	await detail.getByRole("button", { name: "Save", exact: true }).click();
	await expect(
		detail.getByRole("list", { name: "Versions" }).getByRole("button"),
	).toHaveCount(2);

	// Make it the model's default from a chat's Model settings.
	await page.goto("/new");
	await page.getByRole("button", { name: "Model settings" }).click();
	const panel = page.getByRole("dialog", { name: "Model settings" });
	await panel
		.getByLabel(/^Default prompt for/)
		.selectOption({ label: "Reviewer" });
	await page.keyboard.press("Escape");
	await expect(panel).toBeHidden();

	// A new chat with that model starts with it.
	await page.reload();
	await page.getByRole("button", { name: "Model settings" }).click();
	await expect(panel.getByLabel(/^Default prompt for/)).toHaveValue(/.+/);
	await expect(panel.getByText(/this chat uses "Reviewer"/)).toBeVisible();
	await expect(panel.getByLabel("System prompt for this chat")).toHaveAttribute(
		"placeholder",
		"Version two.",
	);
	await page.keyboard.press("Escape");
	await expect(panel).toBeHidden();

	const box = page.getByPlaceholder("Ask anything");
	await box.fill("Hello");
	await box.press("Enter");
	await expect(page.getByText(e2eMockReply("alpha"))).toBeVisible();
	await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);

	const promptRow = async () => {
		await page.getByRole("button", { name: "Reply details" }).click();
		return page.getByRole("link", { name: "Reviewer, version 2" });
	};
	await expect(await promptRow()).toBeVisible();
	await page.keyboard.press("Escape");

	// After a reload the reply still says which version produced it, and links to it.
	await page.reload();
	await expect(page.getByText(e2eMockReply("alpha"))).toBeVisible();
	const link = await promptRow();
	await expect(link).toBeVisible();
	await link.click();
	await expect(page).toHaveURL(/\/prompts\?prompt=.+&version=2$/);
	const opened = page.getByRole("article", { name: "Reviewer" });
	await expect(
		opened.getByRole("region", { name: "Default prompt for" }),
	).toBeVisible();
	await expect(
		opened.getByRole("button", { name: /Version 2 · current/ }),
	).toHaveAttribute("aria-pressed", "true");
});
