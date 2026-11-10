import { expect, test } from "./support/fixtures";

// Roadmap 1.8b: e2e builds have no VITE_SENTRY_DSN, so Sentry must stay unloaded and send nothing, even
// when an error happens. (The fixture also fails the test on any request that leaves this machine.)

test("without a DSN, Sentry never loads and nothing goes to Sentry", async ({
	page,
}) => {
	const requests: string[] = [];
	page.on("request", (request) => requests.push(request.url()));

	await page.goto("/new");
	await page.waitForLoadState("networkidle");
	// An error event as the browser fires it for an uncaught error, which Sentry's handler would catch.
	await page.evaluate(() => {
		window.dispatchEvent(
			new ErrorEvent("error", {
				error: new Error("e2e error"),
				message: "e2e error",
			}),
		);
	});
	await page.goto("/settings");
	await page.waitForLoadState("networkidle");

	expect(await page.evaluate(() => "__SENTRY__" in window)).toBe(false);
	expect(requests.filter((url) => /sentry/i.test(url))).toEqual([]);
});
