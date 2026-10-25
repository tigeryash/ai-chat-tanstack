import { expect, test } from "./support/fixtures";

const EMAIL = "someone@example.test";

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
	await page.waitForLoadState("networkidle");

	await page.getByLabel("Email").fill(EMAIL);
	await page.getByLabel("Password").fill("1234567");
	await page.getByRole("button", { name: "Login", exact: true }).click();

	await expect(page.getByLabel("Password")).toHaveAttribute(
		"aria-invalid",
		"true",
	);
	expect(signInRequests).toEqual([]);
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
