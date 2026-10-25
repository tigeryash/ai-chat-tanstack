import { expect, test } from "./support/fixtures";

const NAME = "Someone";
const EMAIL = "someone@example.test";
const PASSWORD = "a long enough password";

test("the sign-up form masks the password and offers to generate one", async ({
	page,
}) => {
	await page.goto("/signup");

	await expect(page.getByRole("heading", { name: "Sign up" })).toBeVisible();
	await expect(page.getByLabel("Name")).toHaveAttribute("autocomplete", "name");
	await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
	await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
	await expect(page.getByLabel("Password")).toHaveAttribute(
		"autocomplete",
		"new-password",
	);
	await expect(
		page.getByRole("link", { name: "Sign in", exact: true }),
	).toHaveAttribute("href", "/login");
});

test("a password shorter than the server's minimum is rejected before sign-up", async ({
	page,
}) => {
	const signUpRequests: string[] = [];
	page.on("request", (request) => {
		if (request.url().includes("/api/auth/sign-up")) {
			signUpRequests.push(request.url());
		}
	});
	await page.goto("/signup");
	// Wait for hydration; before it, the browser submits the form itself (see the test below).
	await page.waitForLoadState("networkidle");

	await page.getByLabel("Name").fill(NAME);
	await page.getByLabel("Email").fill(EMAIL);
	await page.getByLabel("Password").fill("1234567");
	await page.getByRole("button", { name: "Create account" }).click();

	await expect(page.getByLabel("Password")).toHaveAttribute(
		"aria-invalid",
		"true",
	);
	await expect(page.getByText("Use at least 8 characters")).toBeVisible();
	expect(signUpRequests).toEqual([]);
});

test("after signing up, the page asks for email verification instead of signing in", async ({
	page,
}) => {
	let body: unknown;
	await page.route("**/api/auth/sign-up/email", async (route) => {
		body = route.request().postDataJSON();
		// Better Auth's answer when email verification is required: a user and no session.
		await route.fulfill({
			json: { token: null, user: { id: "u1", name: NAME, email: EMAIL } },
		});
	});
	await page.goto("/signup");
	await page.waitForLoadState("networkidle");

	await page.getByLabel("Name").fill(NAME);
	await page.getByLabel("Email").fill(EMAIL);
	await page.getByLabel("Password").fill(PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();

	await expect(
		page.getByRole("heading", { name: "Check your email" }),
	).toBeFocused();
	await expect(page.getByText(EMAIL)).toBeVisible();
	await expect(page.getByLabel("Password")).toHaveCount(0);
	await expect(page).toHaveURL(/\/signup$/);
	expect(body).toEqual({
		name: NAME,
		email: EMAIL,
		password: PASSWORD,
		callbackURL: "/login",
	});
});

test("explains when this deployment can't send email", async ({ page }) => {
	// convex/emailGuard.ts answers 503 when Brevo isn't configured.
	await page.route("**/api/auth/sign-up/email", (route) =>
		route.fulfill({
			status: 503,
			json: {
				code: "SERVICE_UNAVAILABLE",
				message: "Email sign-up and password reset are unavailable right now.",
			},
		}),
	);
	await page.goto("/signup");
	await page.waitForLoadState("networkidle");

	await page.getByLabel("Name").fill(NAME);
	await page.getByLabel("Email").fill(EMAIL);
	await page.getByLabel("Password").fill(PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();

	await expect(page.getByRole("alert")).toContainText(
		"continue with Google, GitHub or Discord",
	);
	await expect(page.getByLabel("Password")).toBeVisible();
});

test.describe("before the page hydrates", () => {
	test.use({ javaScriptEnabled: false });

	test("submitting never puts the password in the URL", async ({ page }) => {
		await page.goto("/signup");

		await page.getByLabel("Name").fill(NAME);
		await page.getByLabel("Email").fill(EMAIL);
		await page.getByLabel("Password").fill("not-in-the-url");
		const [request] = await Promise.all([
			page.waitForRequest((r) => r.isNavigationRequest()),
			page.getByRole("button", { name: "Create account" }).click(),
		]);

		expect(request.method()).toBe("POST");
		expect(request.url()).not.toContain("not-in-the-url");
		expect(request.url()).not.toContain("password");
	});
});
