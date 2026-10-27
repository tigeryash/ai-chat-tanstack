import { expect, test } from "./support/fixtures";

// No login wall (decision 4): signed-out visitors start on a new chat, and signing in is optional.
test("signed-out visitors land on a new chat", async ({ page }) => {
	await page.goto("/");

	await expect(page).toHaveURL(/\/new$/);
	await expect(page.getByPlaceholder("Ask anything")).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Sign in to sync and share" }),
	).toHaveAttribute("href", "/login");
	await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
});

test("settings work signed out", async ({ page }) => {
	await page.goto("/settings");

	await expect(page).toHaveURL(/\/settings$/);
	await expect(
		page.getByRole("region", { name: "OpenRouter", exact: true }),
	).toBeVisible();
});

test("the login page is optional", async ({ page }) => {
	await page.goto("/login");

	await expect(page.getByText("Sign in to sync and share.")).toBeVisible();
	await page.getByRole("link", { name: "Continue without an account" }).click();
	await expect(page).toHaveURL(/\/new$/);
});
