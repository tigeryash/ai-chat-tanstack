import type { Page } from "@playwright/test";
import { E2E_MOCK_MODEL, E2E_MOCK_REPLY } from "../src/lib/chat/e2e-model";
import { MODEL_CHOICE_STORAGE_KEY } from "../src/lib/chat/model-selection";
import { signInAs } from "./support/accounts";
import { expect, test } from "./support/fixtures";
import { savedMessages, storedRow } from "./support/workspaces";

// Roadmap 1.9: chats stored in this browser belong to the account that made them, or to no account
// when made signed out. Test accounts come from the Convex stub (support/accounts.ts); chats use the
// AI SDK mock model on the real `/new` route.

const replyText = E2E_MOCK_REPLY.join("");
const NO_ACCOUNT = "Not saved to an account";

test.beforeEach(async ({ page }) => {
	await page.addInitScript(
		([key, model]) =>
			localStorage.setItem(key, JSON.stringify({ provider: "local", model })),
		[MODEL_CHOICE_STORAGE_KEY, E2E_MOCK_MODEL],
	);
});

const chatLink = (page: Page, title: string) =>
	page.getByRole("link", { name: title });

const sidebarTitles = (page: Page) =>
	page.getByRole("list", { name: "Recent chats" }).getByRole("link");

const prompt = (page: Page) => page.getByRole("alertdialog");

const signOutButton = (page: Page) =>
	page.getByRole("button", { name: "Sign out", exact: true });

const notFound = (page: Page) => page.getByText("not found", { exact: true });

/** Starts a new chat from the sidebar and waits for the reply to be saved. Returns its URL. */
async function chat(page: Page, text: string): Promise<string> {
	await page.getByRole("link", { name: "New chat" }).click();
	await expect(page).toHaveURL(/\/new$/);
	const box = page.getByPlaceholder("Ask anything");
	await box.fill(text);
	await box.press("Enter");
	await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);
	await expect(page.getByText(replyText)).toBeVisible();
	await expect(page.locator("[data-chat-status]")).toHaveAttribute(
		"data-chat-status",
		"ready",
	);
	await expect(chatLink(page, text)).toBeVisible();
	return new URL(page.url()).pathname;
}

/** Signs in and loads `path`. With `prompt`, waits for the one-time question, which is modal. */
async function signIn(
	page: Page,
	baseURL: string | undefined,
	userId: string,
	{ path = "/new", prompt: expectPrompt = false } = {},
) {
	await signInAs(page.context(), baseURL, userId);
	await page.goto(path);
	await expect(expectPrompt ? prompt(page) : signOutButton(page)).toBeVisible();
}

async function signOut(page: Page) {
	await signOutButton(page).click();
	await expect(
		page.getByRole("link", { name: "Sign in to sync and share" }),
	).toBeVisible();
}

test("signed in, an account sees its own chats plus the no-account ones, marked; signed out, only those", async ({
	page,
	baseURL,
}) => {
	await page.goto("/new");
	await chat(page, "Made signed out");
	await expect(page.getByLabel(NO_ACCOUNT)).toHaveCount(0);

	await signIn(page, baseURL, "user-a", { prompt: true });
	await expect(prompt(page)).toContainText(
		"You have 1 chat from before you signed in",
	);
	await prompt(page)
		.getByRole("button", { name: "Keep them separate" })
		.click();
	await expect(prompt(page)).toHaveCount(0);
	await expect(
		chatLink(page, "Made signed out").getByLabel(NO_ACCOUNT),
	).toBeVisible();

	await chat(page, "Account A plans");
	await expect(
		chatLink(page, "Account A plans").getByLabel(NO_ACCOUNT),
	).toHaveCount(0);
	await expect(sidebarTitles(page)).toHaveText([
		"Account A plans",
		"Made signed out",
	]);

	// The answer is remembered for this account in this browser.
	await page.reload();
	await expect(chatLink(page, "Account A plans")).toBeVisible();
	await expect(prompt(page)).toHaveCount(0);

	await signOut(page);
	await expect(sidebarTitles(page)).toHaveText(["Made signed out"]);
	await expect(page.getByLabel(NO_ACCOUNT)).toHaveCount(0);
});

test("another account never sees an account's chats, not even by URL", async ({
	page,
	baseURL,
}) => {
	await signIn(page, baseURL, "user-a");
	const aChat = await chat(page, "Only for A");

	await signIn(page, baseURL, "user-b");
	await expect(chatLink(page, "Only for A")).toHaveCount(0);
	await page.goto(aChat);
	await expect(notFound(page)).toBeVisible();
	await expect(page.getByText(replyText)).toHaveCount(0);

	await signOut(page);
	await page.goto(aChat);
	await expect(notFound(page)).toBeVisible();
});

test("adding the chats from before sign-in moves them to the account", async ({
	page,
	baseURL,
}) => {
	await page.goto("/new");
	await chat(page, "Before signing in");
	await signIn(page, baseURL, "user-a", { prompt: true });
	await expect(prompt(page)).toContainText("only changes this browser for now");
	await prompt(page)
		.getByRole("button", { name: "Add to your account" })
		.click();
	await expect(prompt(page)).toHaveCount(0);
	await expect(chatLink(page, "Before signing in")).toBeVisible();
	await expect(page.getByLabel(NO_ACCOUNT)).toHaveCount(0);

	// Now the account's: hidden when signed out, back on the next sign-in, with no question.
	await signOut(page);
	await expect(chatLink(page, "Before signing in")).toHaveCount(0);
	await expect(
		page.getByText("Your chats will show up here. They stay in this browser."),
	).toBeVisible();
	await signIn(page, baseURL, "user-a");
	await expect(chatLink(page, "Before signing in")).toBeVisible();
	await expect(prompt(page)).toHaveCount(0);
});

test("deleting the chats from before sign-in asks first", async ({
	page,
	baseURL,
}) => {
	await page.goto("/new");
	await chat(page, "Throwaway question");
	await signIn(page, baseURL, "user-a", { prompt: true });

	await prompt(page).getByRole("button", { name: "Delete them" }).click();
	await expect(prompt(page)).toContainText("Delete 1 chat?");
	await prompt(page).getByRole("button", { name: "Cancel" }).click();
	await expect(prompt(page)).toContainText(
		"You have 1 chat from before you signed in",
	);

	await prompt(page).getByRole("button", { name: "Delete them" }).click();
	await prompt(page).getByRole("button", { name: "Delete 1 chat" }).click();
	await expect(prompt(page)).toHaveCount(0);
	await expect(chatLink(page, "Throwaway question")).toHaveCount(0);

	await signOut(page);
	await expect(chatLink(page, "Throwaway question")).toHaveCount(0);
});

test("signing out hides the account's chats until it signs in again", async ({
	page,
	baseURL,
}) => {
	await page.goto("/new");
	await chat(page, "Shared on this browser");
	await signIn(page, baseURL, "user-a", { prompt: true });
	await prompt(page)
		.getByRole("button", { name: "Keep them separate" })
		.click();
	const aChat = await chat(page, "Private to A");

	// Signing out from A's chat leaves it. The no-account chat stays.
	await signOut(page);
	await expect(page).toHaveURL(/\/new$/);
	await expect(sidebarTitles(page)).toHaveText(["Shared on this browser"]);

	await signIn(page, baseURL, "user-a", { path: aChat });
	await expect(page.getByText(replyText)).toBeVisible();
	await expect(sidebarTitles(page)).toHaveText([
		"Private to A",
		"Shared on this browser",
	]);
});

test("signing out and removing deletes the account's chats here, after a confirm", async ({
	page,
	baseURL,
}) => {
	await page.goto("/new");
	await chat(page, "Shared on this browser");
	await signIn(page, baseURL, "user-a", { prompt: true });
	await prompt(page)
		.getByRole("button", { name: "Keep them separate" })
		.click();
	const aChat = await chat(page, "Private to A");

	await page.getByRole("button", { name: "More ways to sign out" }).click();
	await page
		.getByRole("menuitem", {
			name: "Sign out and remove my chats from this device",
		})
		.click();
	const confirm = page.getByRole("alertdialog");
	await expect(confirm).toContainText(
		"1 chat from your account will be deleted from this browser",
	);
	await expect(confirm).toContainText("A plain Sign out only hides your chats");
	await confirm.getByRole("button", { name: "Sign out and remove" }).click();
	await expect(
		page.getByRole("link", { name: "Sign in to sync and share" }),
	).toBeVisible();
	await expect(page).toHaveURL(/\/new$/);
	await expect(sidebarTitles(page)).toHaveText(["Shared on this browser"]);

	// Gone for good: A's next sign-in doesn't bring it back.
	await signIn(page, baseURL, "user-a");
	await expect(sidebarTitles(page)).toHaveText(["Shared on this browser"]);
	await page.goto(aChat);
	await expect(notFound(page)).toBeVisible();
});

test("a workspace never drops or deletes a pane of another account's chat (quality audit Q2, W2–W4)", async ({
	page,
	baseURL,
}) => {
	test.setTimeout(90_000);
	const panes = page.locator("section[data-pane-id]");
	const pane = (n: number) =>
		page.getByRole("region", { name: `Pane ${n}`, exact: true });
	const workspaceEntry = page
		.getByRole("list", { name: "Recent chats" })
		.getByRole("link", { name: /^Before signing in/ });
	const chatIdOf = async (n: number) =>
		(await pane(n).getAttribute("data-pane-id")) ?? "";
	/** Sends from pane `n` and waits until each pane in `replying` has saved its first exchange. */
	const send = async (n: number, text: string, replying: number[]) => {
		await pane(n).getByPlaceholder("Ask anything").fill(text);
		await pane(n).getByPlaceholder("Ask anything").press("Enter");
		await expect(pane(n).getByText(text)).toBeVisible();
		for (const each of await panes.all()) {
			await expect(each.locator("[data-chat-status]")).toHaveAttribute(
				"data-chat-status",
				"ready",
			);
		}
		// "ready" comes before the save, and every step after this leaves the page.
		for (const each of replying) {
			const chatId = await chatIdOf(each);
			await expect.poll(() => savedMessages(page, chatId)).toBe(2);
		}
	};

	// Signed out: a two-pane workspace with a reply in both.
	await page.goto("/new");
	await page.getByRole("button", { name: "Add pane" }).click();
	await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/);
	const workspaceUrl = new URL(page.url()).pathname;
	await expect(panes).toHaveCount(2);
	await send(1, "Before signing in", [1, 2]);

	// Signed in, keeping the no-account chats apart: a third pane is the account's (W4).
	await signIn(page, baseURL, "user-a", { path: workspaceUrl, prompt: true });
	await prompt(page)
		.getByRole("button", { name: "Keep them separate" })
		.click();
	await expect(panes).toHaveCount(2);
	await page.getByRole("button", { name: "Add pane" }).click();
	await expect(panes).toHaveCount(3);
	await pane(1).getByRole("switch", { name: "Sync Pane 1" }).click();
	await pane(2).getByRole("switch", { name: "Sync Pane 2" }).click();
	await send(3, "Account A only", [3]);

	// Signed out, the account's pane is hidden, and a change to the workspace keeps it (W2).
	await signOut(page);
	await page.goto(workspaceUrl);
	await expect(panes).toHaveCount(2);
	await expect(page.getByText("Account A only")).toHaveCount(0);
	await expect(workspaceEntry).toContainText("2");
	await pane(1).getByRole("switch", { name: "Sync Pane 1" }).click();
	// The change is saved before signing in reloads the page.
	const workspaceId = workspaceUrl.split("/").at(-1) ?? "";
	const firstChat = await chatIdOf(1);
	await expect
		.poll(async () => {
			const row = await storedRow<{
				panes: { chatId: string; synced: boolean }[];
			}>(page, "workspaces", workspaceId);
			return {
				panes: row?.panes.length,
				synced: row?.panes.find((each) => each.chatId === firstChat)?.synced,
			};
		})
		.toEqual({ panes: 3, synced: true });
	await signIn(page, baseURL, "user-a", { path: workspaceUrl });
	await expect(panes).toHaveCount(3);
	await expect(pane(3).getByText("Account A only")).toBeVisible();

	// Signed out, deleting the workspace deletes only the two panes' chats it shows (W3).
	await signOut(page);
	await page.goto("/new");
	await page
		.getByRole("button", { name: "Options for Before signing in" })
		.click();
	await page.getByRole("menuitem", { name: "Delete" }).click();
	const confirm = page.getByRole("alertdialog");
	await expect(confirm).toContainText("its 2 panes");
	await confirm.getByRole("button", { name: "Delete" }).click();
	await expect(workspaceEntry).toHaveCount(0);
	await page.goto(workspaceUrl);
	await expect(notFound(page)).toBeVisible();

	// The account still has its chat, in what's left of the workspace.
	await signIn(page, baseURL, "user-a", { path: workspaceUrl });
	await expect(panes).toHaveCount(1);
	await expect(pane(1).getByText("Account A only")).toBeVisible();
	await expect(page.getByText("Before signing in")).toHaveCount(0);
});
