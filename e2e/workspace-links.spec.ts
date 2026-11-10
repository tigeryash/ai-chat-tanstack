import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { openModelLink, WORKSPACE_URL } from "./support/workspaces";

// Roadmap 3.5: deep links `/new?models=a,b,c` against the seeded catalog the Convex stub serves
// (src/lib/models/catalog.fixtures.ts), and saved layouts that open again as new workspaces. No keys
// are connected, so nothing is sent: each pane just shows its model.

const OPUS = "anthropic/claude-opus-5.5";
const GPT = "openai/gpt-5.5";

const pane = (page: Page, n: number) =>
	page.getByRole("region", { name: `Pane ${n}`, exact: true });
const panes = (page: Page) => page.locator("section[data-pane-id]");
const modelButton = (page: Page, n: number) =>
	pane(page, n).getByRole("button", { name: /^Model: / });

async function expectPaneModels(page: Page, names: readonly string[]) {
	await expect(panes(page)).toHaveCount(names.length);
	for (const [index, name] of names.entries()) {
		await expect(modelButton(page, index + 1)).toContainText(name);
	}
}

test("a models link opens a pane per catalog model and says which it couldn't find", async ({
	page,
}) => {
	await openModelLink(page, [OPUS, GPT, "nobody/nothing"]);
	await expect(page).toHaveURL(/missing=1/);
	await expectPaneModels(page, ["Claude Opus 5.5", "GPT-5.5"]);
	await expect(
		page.getByRole("status").filter({
			hasText: "1 model from the link isn't in the catalog.",
		}),
	).toBeVisible();
});

test("a link with one model starts a new chat on it; one with none says so", async ({
	page,
}) => {
	await page.goto(`/new?models=${GPT}`);
	await expect(page.getByRole("button", { name: /^Model: / })).toContainText(
		"GPT-5.5",
	);
	await expect(panes(page)).toHaveCount(0);

	await page.goto("/new?models=nobody/nothing,<b>");
	await expect(
		page.getByRole("status").filter({
			hasText: "None of the link's models are in the catalog.",
		}),
	).toBeVisible();
	await expect(page.getByPlaceholder("Ask anything")).toBeVisible();
});

test("a saved layout survives a reload and opens again as a new workspace", async ({
	page,
}) => {
	await openModelLink(page, [OPUS, GPT]);
	await expectPaneModels(page, ["Claude Opus 5.5", "GPT-5.5"]);
	const first = page.url();

	await page.getByRole("button", { name: "Layouts" }).click();
	const menu = page.getByRole("dialog", { name: "Layouts" });
	await menu.getByLabel("Save this layout").fill("Head to head");
	await menu.getByRole("button", { name: "Save", exact: true }).click();
	await expect(menu.getByText("Saved “Head to head”.")).toBeVisible();
	await page.keyboard.press("Escape");

	// The workspace itself comes back after a reload, and so does the saved layout.
	await page.reload();
	await expectPaneModels(page, ["Claude Opus 5.5", "GPT-5.5"]);
	await page.goto("/new");
	await page.getByRole("button", { name: "Layouts" }).click();
	await page
		.getByRole("dialog", { name: "Layouts" })
		.getByRole("button", { name: "Open Head to head" })
		.click();
	await expect(page).toHaveURL(WORKSPACE_URL);
	expect(page.url()).not.toBe(first);
	await expectPaneModels(page, ["Claude Opus 5.5", "GPT-5.5"]);

	await page.getByRole("button", { name: "Layouts" }).click();
	await page
		.getByRole("dialog", { name: "Layouts" })
		.getByRole("button", { name: "Delete Head to head" })
		.click();
	await expect(
		page
			.getByRole("dialog", { name: "Layouts" })
			.getByText("No saved layouts yet."),
	).toBeVisible();
});
