import type { Page, Route } from "@playwright/test";
import { expect, test } from "./support/fixtures";

const EMAIL = "someone@example.test";
const PASSWORD = "a long enough password";
const RESEND_URL = "**/api/auth/send-verification-email";
// Better Auth's answer to every resend request without a session: unknown, verified and unverified
// addresses all get this, after the same 500 ms floor.
const RESEND_ACCEPTED = { status: true };
const RESEND_CONFIRMATION = "If that address still needs verifying";

test("the password field is masked and offered to password managers", async ({
	page,
}) => {
	await page.goto("/login");

	await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
	await expect(page.getByLabel("Password")).toHaveAttribute(
		"autocomplete",
		"current-password",
	);
	await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
});

test("a password shorter than the server's minimum is rejected before sign-in", async ({
	page,
}) => {
	const signInRequests: string[] = [];
	page.on("request", (request) => {
		if (request.url().includes("/api/auth/sign-in")) {
			signInRequests.push(request.url());
		}
	});
	await page.goto("/login");
	// Wait for hydration; before it, the browser submits the form itself (see the test below).
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();

	await page.getByLabel("Email").fill(EMAIL);
	await page.getByLabel("Password").fill("1234567");
	await page.getByRole("button", { name: "Login", exact: true }).click();

	await expect(page.getByLabel("Password")).toHaveAttribute(
		"aria-invalid",
		"true",
	);
	expect(signInRequests).toEqual([]);
});

test("links to sign-up and to password reset", async ({ page }) => {
	await page.goto("/login");
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();

	await page.getByRole("link", { name: "Create an account" }).click();
	await expect(page).toHaveURL(/\/signup$/);
	await expect(page.getByRole("heading", { name: "Sign up" })).toBeVisible();

	await page.getByRole("link", { name: "Sign in", exact: true }).click();
	await page.getByRole("link", { name: "Forgot password?" }).click();
	await expect(page).toHaveURL(/\/forgot-password$/);
	await expect(
		page.getByRole("heading", { name: "Forgot password" }),
	).toBeVisible();
});

test("a sign-in the server refuses says why", async ({ page }) => {
	await page.route("**/api/auth/sign-in/email", (route) =>
		route.fulfill({
			status: 403,
			json: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
		}),
	);
	await page.goto("/login");
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();

	await page.getByLabel("Email").fill(EMAIL);
	await page.getByLabel("Password").fill("a long enough password");
	await page.getByRole("button", { name: "Login", exact: true }).click();

	await expect(page.getByRole("alert")).toContainText(
		"Verify your email first",
	);
	await expect(page).toHaveURL(/\/login$/);
});

/** Signs in with an address Better Auth hasn't verified yet, so the page offers a new link. */
async function signInUnverified(page: Page) {
	await page.route("**/api/auth/sign-in/email", (route) =>
		route.fulfill({
			status: 403,
			json: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
		}),
	);
	await page.goto("/login");
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();

	await page.getByLabel("Email").fill(EMAIL);
	await page.getByLabel("Password").fill(PASSWORD);
	await page.getByRole("button", { name: "Login", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText(
		"Verify your email first",
	);
}

test("an unverified address can ask for a new link, and the answer doesn't say whether one was sent", async ({
	page,
}) => {
	let body: unknown;
	await page.route(RESEND_URL, async (route) => {
		body = route.request().postDataJSON();
		await route.fulfill({ json: RESEND_ACCEPTED });
	});
	await signInUnverified(page);

	await page.getByRole("button", { name: "Resend verification email" }).click();

	await expect(page.getByText(RESEND_CONFIRMATION)).toBeFocused();
	await expect(
		page.getByRole("button", { name: "Resend verification email" }),
	).toHaveCount(0);
	await expect(page.getByText(EMAIL)).toHaveCount(0);
	expect(body).toEqual({ email: EMAIL, callbackURL: "/login" });
});

test("a new sign-in attempt withdraws the offer of a new link", async ({
	page,
}) => {
	await signInUnverified(page);
	await expect(
		page.getByRole("button", { name: "Resend verification email" }),
	).toBeVisible();
	await page.route("**/api/auth/sign-in/email", (route) =>
		route.fulfill({
			status: 401,
			json: {
				code: "INVALID_EMAIL_OR_PASSWORD",
				message: "Invalid email or password",
			},
		}),
	);

	await page.getByRole("button", { name: "Login", exact: true }).click();

	await expect(page.getByRole("alert")).toContainText(
		"Invalid email or password",
	);
	await expect(
		page.getByRole("button", { name: "Resend verification email" }),
	).toHaveCount(0);
});

const RESEND_FAILURES: [string, (route: Route) => Promise<void>, string][] = [
	[
		// convex/emailGuard.ts answers 503 when Brevo isn't configured.
		"this deployment can't send email",
		(route) =>
			route.fulfill({
				status: 503,
				json: {
					code: "SERVICE_UNAVAILABLE",
					message:
						"Email sign-up and password reset are unavailable right now.",
				},
			}),
		"aren't available right now",
	],
	[
		"there were too many requests",
		(route) => route.fulfill({ status: 429, json: { message: "Too many" } }),
		"Too many attempts",
	],
	[
		"the request never got an answer",
		(route) => route.abort("internetdisconnected"),
		"Couldn't reach the server",
	],
	[
		// The server's message isn't shown: it can carry Brevo's rejection.
		"the email failed to send",
		(route) =>
			route.fulfill({
				status: 500,
				json: { message: "Brevo rejected the email: HTTP 400 (invalid)" },
			}),
		"Couldn't send the email",
	],
];

for (const [name, answer, message] of RESEND_FAILURES) {
	test(`resending says so when ${name}`, async ({ page }) => {
		await page.route(RESEND_URL, answer);
		await signInUnverified(page);

		await page
			.getByRole("button", { name: "Resend verification email" })
			.click();

		await expect(
			page.getByRole("alert").filter({ hasText: message }),
		).toBeVisible();
		await expect(page.getByText("Brevo")).toHaveCount(0);
		await expect(page.getByText(RESEND_CONFIRMATION)).toHaveCount(0);
		// Still there, to try again.
		await expect(
			page.getByRole("button", { name: "Resend verification email" }),
		).toBeEnabled();
	});
}

// Better Auth's verify-email endpoint redirects a failed link to the sign-up callbackURL with these.
for (const [error, message] of [
	["TOKEN_EXPIRED", "That verification link has expired"],
	["INVALID_TOKEN", "That verification link didn't work"],
	["USER_NOT_FOUND", "We couldn't find an account for that verification link"],
	["INVALID_USER", "That verification link didn't work"],
]) {
	test(`a verification link that failed with ${error} explains itself above the form`, async ({
		page,
	}) => {
		await page.goto(`/login?error=${error}`);
		await expect(page.locator("main[data-hydrated='true']")).toBeAttached();

		await expect(page.getByRole("alert")).toContainText(message);
		await expect(page.getByLabel("Email")).toBeVisible();
	});
}

test("an unknown ?error= shows nothing from the URL", async ({ page }) => {
	await page.goto(
		`/login?error=${encodeURIComponent("<b>Call 555-0100 to restore your account</b>")}`,
	);
	await expect(page.locator("main[data-hydrated='true']")).toBeAttached();

	await expect(page.getByLabel("Email")).toBeVisible();
	await expect(page.getByRole("alert")).toHaveCount(0);
	await expect(page.locator("body")).not.toContainText("555-0100");
});

test.describe("before the page hydrates", () => {
	test.use({ javaScriptEnabled: false });

	test("submitting never puts the password in the URL", async ({ page }) => {
		await page.goto("/login");

		await page.getByLabel("Email").fill(EMAIL);
		await page.getByLabel("Password").fill("not-in-the-url");
		const [request] = await Promise.all([
			page.waitForRequest((r) => r.isNavigationRequest() && r !== null),
			page.getByRole("button", { name: "Login", exact: true }).click(),
		]);

		expect(request.method()).toBe("POST");
		expect(request.url()).not.toContain("not-in-the-url");
		expect(request.url()).not.toContain("password");
	});
});
