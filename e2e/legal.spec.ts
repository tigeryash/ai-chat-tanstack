import { expect, test } from "./support/fixtures";

// The privacy policy and terms (roadmap 7.1) are public, server-rendered pages: Google's OAuth
// consent screen links to /privacy, so it must work without JavaScript or a session.
for (const { path, heading } of [
	{ path: "/privacy", heading: "Privacy Policy" },
	{ path: "/terms", heading: "Terms of Service" },
]) {
	test(`${path} is server-rendered`, async ({ request }) => {
		const response = await request.get(path);
		expect(response.status()).toBe(200);
		const html = await response.text();
		expect(html).toContain(`>${heading}</h1>`);
		expect(html).toContain("Not legal advice");
	});

	test(`${path} renders signed out`, async ({ page }) => {
		await page.goto(path);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
		await expect(page).toHaveTitle(`${heading} · High Elo LLMs`);
	});
}

test("the auth pages and settings link to the legal pages", async ({
	page,
}) => {
	await page.goto("/login");
	await page.getByRole("link", { name: "Privacy", exact: true }).click();
	await expect(page).toHaveURL(/\/privacy$/);
	await page
		.getByRole("navigation", { name: "Legal" })
		.getByRole("link", { name: "Terms" })
		.click();
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"Terms of Service",
	);

	await page.goto("/settings");
	await page.getByRole("link", { name: "Privacy Policy" }).click();
	await expect(page).toHaveURL(/\/privacy$/);
});
