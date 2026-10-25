import { expect, test } from "./support/fixtures";

const EMAIL = "someone@example.test";
// Better Auth's answer to every reset request, whether or not the account exists.
const RESET_REQUESTED = {
	status: true,
	message:
		"If this email exists in our system, check your email for the reset link",
};

test("the forgot-password form asks for an email", async ({ page }) => {
	await page.goto("/forgot-password");

	await expect(
		page.getByRole("heading", { name: "Forgot password" }),
	).toBeVisible();
	await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
	await expect(page.getByLabel("Email")).toHaveAttribute(
		"autocomplete",
		"email",
	);
	await expect(
		page.getByRole("link", { name: "Back to sign in" }),
	).toHaveAttribute("href", "/login");
});

test("a malformed email is rejected before any request", async ({ page }) => {
	const resetRequests: string[] = [];
	page.on("request", (request) => {
		if (request.url().includes("/api/auth/request-password-reset")) {
			resetRequests.push(request.url());
		}
	});
	await page.goto("/forgot-password");
	await page.waitForLoadState("networkidle");

	await page.getByLabel("Email").fill("not-an-email");
	await page.getByRole("button", { name: "Send reset link" }).click();

	await expect(page.getByLabel("Email")).toHaveAttribute(
		"aria-invalid",
		"true",
	);
	expect(resetRequests).toEqual([]);
});

test("every address gets the same answer, which doesn't say whether it has an account", async ({
	page,
}) => {
	let body: unknown;
	await page.route("**/api/auth/request-password-reset", async (route) => {
		body = route.request().postDataJSON();
		await route.fulfill({ json: RESET_REQUESTED });
	});
	await page.goto("/forgot-password");
	await page.waitForLoadState("networkidle");

	await page.getByLabel("Email").fill(EMAIL);
	await page.getByRole("button", { name: "Send reset link" }).click();

	await expect(
		page.getByRole("heading", { name: "Check your email" }),
	).toBeFocused();
	await expect(
		page.getByText("If an account exists for that address"),
	).toBeVisible();
	await expect(page.getByText(EMAIL)).toHaveCount(0);
	expect(body).toEqual({ email: EMAIL, redirectTo: "/reset-password" });
});

test("explains when this deployment can't send email", async ({ page }) => {
	await page.route("**/api/auth/request-password-reset", (route) =>
		route.fulfill({
			status: 503,
			json: {
				code: "SERVICE_UNAVAILABLE",
				message: "Email sign-up and password reset are unavailable right now.",
			},
		}),
	);
	await page.goto("/forgot-password");
	await page.waitForLoadState("networkidle");

	await page.getByLabel("Email").fill(EMAIL);
	await page.getByRole("button", { name: "Send reset link" }).click();

	await expect(page.getByRole("alert")).toContainText(
		"aren't available right now",
	);
});

test.describe("before the page hydrates", () => {
	test.use({ javaScriptEnabled: false });

	test("submitting never puts the email in the URL", async ({ page }) => {
		await page.goto("/forgot-password");

		await page.getByLabel("Email").fill(EMAIL);
		const [request] = await Promise.all([
			page.waitForRequest((r) => r.isNavigationRequest()),
			page.getByRole("button", { name: "Send reset link" }).click(),
		]);

		expect(request.method()).toBe("POST");
		expect(request.url()).not.toContain("someone");
		expect(request.url()).not.toContain("email");
	});
});
