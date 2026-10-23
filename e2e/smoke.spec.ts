import { expect, test } from "./support/fixtures";

test("signed-out visitors land on the login form", async ({ page }) => {
	await page.goto("/");

	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByLabel("Email")).toBeVisible();
	await expect(page.getByLabel("Password")).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Login", exact: true }),
	).toBeVisible();
});

test("the dashboard sends signed-out visitors to login", async ({ page }) => {
	await page.goto("/new");

	await expect(page).toHaveURL(/\/login$/);
});
