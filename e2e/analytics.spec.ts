import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";

// Roadmap 1.8: Vercel Web Analytics and Speed Insights under the CSP, and the Settings opt-out. The
// scripts Vercel serves at /_vercel/… don't exist outside Vercel, so stand-ins load from the same paths
// and post to the same endpoints the real ones use. The fixture fails the test on any CSP violation.

const SCRIPTS = {
	"/_vercel/insights/script.js": "/_vercel/insights/view",
	"/_vercel/speed-insights/script.js": "/_vercel/speed-insights/vitals",
} as const;

/** Serves the stand-in scripts and records which scripts loaded and what they posted. */
async function stubVercel(page: Page) {
	const loaded: string[] = [];
	const posted: string[] = [];
	for (const [script, endpoint] of Object.entries(SCRIPTS)) {
		await page.route(`**${script}`, (route) => {
			loaded.push(script);
			return route.fulfill({
				contentType: "text/javascript",
				body: `fetch(${JSON.stringify(endpoint)}, { method: "POST", body: JSON.stringify({ o: location.href }), keepalive: true });`,
			});
		});
		await page.route(`**${endpoint}`, (route) => {
			posted.push(endpoint);
			return route.fulfill({ status: 200, body: "OK" });
		});
	}
	return { loaded, posted };
}

const recorded = (page: Page) =>
	page.evaluate(() =>
		(window.__highEloAnalytics ?? []).map((event) => event.name),
	);

const analyticsSwitch = (page: Page) =>
	page.getByRole("switch", { name: "Share anonymous usage analytics" });

test("both Vercel scripts load and report without a CSP violation", async ({
	page,
}) => {
	const vercel = await stubVercel(page);
	await page.goto("/e2e/analytics");
	await expect
		.poll(() => vercel.posted.sort())
		.toEqual(["/_vercel/insights/view", "/_vercel/speed-insights/vitals"]);
	expect(vercel.loaded.sort()).toEqual(Object.keys(SCRIPTS).sort());
});

test("the Settings switch turns track() off, and the scripts don't load", async ({
	page,
}) => {
	const vercel = await stubVercel(page);
	await page.goto("/settings");
	const local = page.getByRole("region", { name: "Local models" });
	const addServer = async (name: string) => {
		await local.getByRole("button", { name: "Add local server" }).click();
		await local.getByLabel("Name").fill(name);
		await local.getByRole("button", { name: "Add server" }).click();
		await expect(local.getByRole("region", { name })).toBeVisible();
	};

	await expect(analyticsSwitch(page)).toBeChecked();
	await addServer("First");
	expect(await recorded(page)).toEqual(["local_endpoint_added"]);

	await analyticsSwitch(page).click();
	await expect(analyticsSwitch(page)).not.toBeChecked();
	await addServer("Second");
	expect(await recorded(page)).toEqual(["local_endpoint_added"]);

	// Off is stored in this browser: after a reload, nothing loads.
	await page.goto("/e2e/analytics");
	await expect(analyticsSwitch(page)).not.toBeChecked();
	await page.waitForLoadState("networkidle");
	expect(vercel.loaded).toEqual([]);

	// Switched back on, both load without a reload.
	await analyticsSwitch(page).click();
	await expect.poll(() => vercel.loaded.length).toBe(2);
});

test("Global Privacy Control keeps analytics off and the switch locked", async ({
	page,
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(Navigator.prototype, "globalPrivacyControl", {
			get: () => true,
		});
	});
	const vercel = await stubVercel(page);
	await page.goto("/e2e/analytics");
	await expect(analyticsSwitch(page)).not.toBeChecked();
	await expect(analyticsSwitch(page)).toBeDisabled();
	await expect(
		page.getByText("Your browser asks sites not to track"),
	).toBeVisible();
	await page.waitForLoadState("networkidle");
	expect(vercel.loaded).toEqual([]);
});
