import { expect, test } from "./support/fixtures";

// Better Auth's emailed link checks the token, then redirects to one of these.
const RESET_URL = "/reset-password?token=test-reset-token";
const EXPIRED_URL = "/reset-password?error=INVALID_TOKEN";
const PASSWORD = "a long enough password";

test("the reset form masks the new password and offers to generate one", async ({
	page,
}) => {
	await page.goto(RESET_URL);

	await expect(
		page.getByRole("heading", { name: "Reset password" }),
	).toBeVisible();
	await expect(page.getByLabel("New password")).toHaveAttribute(
		"type",
		"password",
	);
	await expect(page.getByLabel("New password")).toHaveAttribute(
		"autocomplete",
		"new-password",
	);
});

test("a password shorter than the server's minimum is rejected before the reset", async ({
	page,
}) => {
	const resetRequests: string[] = [];
	page.on("request", (request) => {
		if (request.url().includes("/api/auth/reset-password")) {
			resetRequests.push(request.url());
		}
	});
	await page.goto(RESET_URL);
	// Wait for hydration; before it, the browser submits the form itself (see the test below).
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();

	await page.getByLabel("New password").fill("1234567");
	await page.getByRole("button", { name: "Reset password" }).click();

	await expect(page.getByLabel("New password")).toHaveAttribute(
		"aria-invalid",
		"true",
	);
	expect(resetRequests).toEqual([]);
});

test("the token from the link goes in the request body, then the page confirms", async ({
	page,
}) => {
	let body: unknown;
	await page.route("**/api/auth/reset-password", async (route) => {
		body = route.request().postDataJSON();
		await route.fulfill({ json: { status: true } });
	});
	await page.goto(RESET_URL);
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();

	await page.getByLabel("New password").fill(PASSWORD);
	await page.getByRole("button", { name: "Reset password" }).click();

	await expect(
		page.getByRole("heading", { name: "Password updated" }),
	).toBeFocused();
	await expect(page.getByRole("link", { name: "Go to sign in" })).toBeVisible();
	expect(body).toEqual({ newPassword: PASSWORD, token: "test-reset-token" });
});

test("a link that was already used offers a new one", async ({ page }) => {
	await page.route("**/api/auth/reset-password", (route) =>
		route.fulfill({
			status: 400,
			json: { code: "INVALID_TOKEN", message: "Invalid token" },
		}),
	);
	await page.goto(RESET_URL);
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();

	await page.getByLabel("New password").fill(PASSWORD);
	await page.getByRole("button", { name: "Reset password" }).click();

	await expect(
		page.getByRole("heading", { name: "This link doesn't work" }),
	).toBeFocused();
	await expect(
		page.getByRole("link", { name: "Request a new link" }),
	).toHaveAttribute("href", "/forgot-password");
});

for (const [name, url] of [
	["an expired link", EXPIRED_URL],
	["a link without a token", "/reset-password"],
]) {
	test(`${name} shows no form and offers a new link`, async ({ page }) => {
		await page.goto(url);

		await expect(
			page.getByRole("heading", { name: "This link doesn't work" }),
		).toBeVisible();
		await expect(page.getByLabel("New password")).toHaveCount(0);
		await expect(
			page.getByRole("link", { name: "Request a new link" }),
		).toBeVisible();
	});
}

test.describe("before the page hydrates", () => {
	test.use({ javaScriptEnabled: false });

	test("submitting never puts the password in the URL", async ({ page }) => {
		await page.goto(RESET_URL);

		await page.getByLabel("New password").fill("not-in-the-url");
		const [request] = await Promise.all([
			page.waitForRequest((r) => r.isNavigationRequest()),
			page.getByRole("button", { name: "Reset password" }).click(),
		]);

		expect(request.method()).toBe("POST");
		expect(request.url()).not.toContain("not-in-the-url");
		expect(request.url()).not.toContain("password=");
	});
});
