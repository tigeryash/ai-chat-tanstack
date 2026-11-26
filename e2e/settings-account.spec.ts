import type { Page } from "@playwright/test";
import { signInAs } from "./support/accounts";
import { expect, test } from "./support/fixtures";
import { settingsDialog } from "./support/settings";

// Roadmap R2 S8: Settings → Account. Signed out it's a sign-in card; signed in (the Convex stub's test
// session, support/accounts.ts) it shows the profile, linked sign-in methods and both ways to sign out.

const breadcrumb = (page: Page) =>
	settingsDialog(page).getByRole("heading", { name: /^Settings/ });
const signInCard = (page: Page) =>
	settingsDialog(page).getByRole("region", {
		name: "Sign in to sync and share",
	});
const sidebarSignIn = (page: Page) =>
	page.getByRole("link", { name: "Sign in to sync and share" });

/** The modal dialog may hide the page behind it from the accessibility tree (Base UI marks it `aria-hidden`
 * when it was already mounted as the dialog opened), so close it before looking at the sidebar. */
async function expectSidebarSignedOut(page: Page) {
	await settingsDialog(page)
		.getByRole("button", { name: "Close settings" })
		.click();
	await expect(settingsDialog(page)).toHaveCount(0);
	await expect(sidebarSignIn(page)).toBeVisible();
}

async function openAccountSignedIn(
	page: Page,
	baseURL: string | undefined,
	userId: string,
) {
	await signInAs(page.context(), baseURL, userId);
	await page.goto("/new?settings=account");
	await expect(breadcrumb(page)).toHaveText("Settings/Account");
	await expect(page.locator("#setting-profile")).toBeVisible();
}

test("signed out, Account is a sign-in card linking to sign-in and sign-up", async ({
	page,
}) => {
	await page.goto("/new?settings=account");
	await expect(breadcrumb(page)).toHaveText("Settings/Account");
	await expect(signInCard(page)).toBeVisible();
	await expect(page.locator("#setting-profile")).toHaveCount(0);
	await expect(
		signInCard(page).getByRole("link", { name: "Create an account" }),
	).toHaveAttribute("href", "/signup");

	await signInCard(page).getByRole("link", { name: "Sign in" }).click();
	await expect(page).toHaveURL(/\/login$/);
	await expect(settingsDialog(page)).toHaveCount(0);
});

test("signed in, Account shows the profile and linked sign-in methods", async ({
	page,
	baseURL,
}) => {
	await openAccountSignedIn(page, baseURL, "ada-lovelace");
	const profile = page.locator("#setting-profile");
	await expect(profile.getByTestId("account-name")).toHaveText("ada-lovelace");
	await expect(profile.getByTestId("account-email")).toHaveText(
		"ada-lovelace@example.com",
	);

	const methods = page
		.locator("#setting-sign-in-methods")
		.getByRole("list", { name: "Linked sign-in methods" })
		.getByRole("listitem");
	await expect(methods).toHaveText([
		"Email and passwordLinked",
		"GoogleNot linked",
		"GitHubLinked",
		"DiscordNot linked",
	]);
	await expect(signInCard(page)).toHaveCount(0);
});

test("search finds Sign out, and signing out turns Account into the sign-in card", async ({
	page,
	baseURL,
}) => {
	await signInAs(page.context(), baseURL, "user-a");
	await page.goto("/new?settings=general");
	const search = settingsDialog(page).getByRole("searchbox", {
		name: "Search settings",
	});
	await search.fill("logout");
	await search.press("Enter");
	await expect(breadcrumb(page)).toHaveText("Settings/Account");
	const row = page.locator("#setting-sign-out");
	await expect(row).toBeFocused();

	await row.getByRole("button", { name: "Sign out", exact: true }).click();
	await expect(signInCard(page)).toBeVisible();
	await expect(page.locator("#setting-sign-out")).toHaveCount(0);

	// The session is really gone: a reload stays signed out.
	await page.reload();
	await expect(signInCard(page)).toBeVisible();
	await expectSidebarSignedOut(page);
});

test("sign out and remove asks first, then signs out", async ({
	page,
	baseURL,
}) => {
	await openAccountSignedIn(page, baseURL, "user-b");
	await page
		.locator("#setting-sign-out-remove-chats")
		.getByRole("button", { name: "Sign out and remove" })
		.click();
	const confirm = page.getByRole("alertdialog");
	await expect(confirm).toContainText(
		"There are no chats from your account in this browser",
	);
	await confirm.getByRole("button", { name: "Cancel" }).click();
	await expect(confirm).toHaveCount(0);
	await expect(page.locator("#setting-profile")).toBeVisible();

	await page
		.locator("#setting-sign-out-remove-chats")
		.getByRole("button", { name: "Sign out and remove" })
		.click();
	await confirm.getByRole("button", { name: "Sign out and remove" }).click();
	await expect(signInCard(page)).toBeVisible();
	await expectSidebarSignedOut(page);
});
