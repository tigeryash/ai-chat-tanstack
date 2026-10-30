// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsSettings } from "./consent";

// startVercelAnalytics keeps a once-per-page flag, so each test loads a fresh copy.
async function freshStart() {
	vi.resetModules();
	const { startVercelAnalytics } = await import("./vercel");
	return startVercelAnalytics;
}

const scriptSources = () =>
	[...document.head.querySelectorAll("script")].map((script) =>
		script.getAttribute("src"),
	);

describe("startVercelAnalytics", () => {
	beforeEach(() => {
		document.head.innerHTML = "";
		localStorage.clear();
		analyticsSettings.write({ enabled: true });
		delete window.va;
		delete window.vaq;
		delete window.si;
		delete window.siq;
	});

	it("loads both scripts from this site", async () => {
		(await freshStart())();
		expect(scriptSources()).toEqual([
			"/_vercel/insights/script.js",
			"/_vercel/speed-insights/script.js",
		]);
	});

	it("loads nothing while analytics are off", async () => {
		const { setAnalyticsEnabled } = await import("./consent");
		setAnalyticsEnabled(false);
		(await freshStart())();
		expect(scriptSources()).toEqual([]);
	});

	it("strips page URLs, and drops events once switched off", async () => {
		(await freshStart())();
		const beforeSend = window.vaq?.find(
			([kind]) => kind === "beforeSend",
		)?.[1] as (event: { type: string; url: string }) => { url: string } | null;
		expect(
			beforeSend({
				type: "pageview",
				url: "https://www.highelollms.com/settings?code=abc",
			}),
		).toEqual({
			type: "pageview",
			url: "https://www.highelollms.com/settings",
		});

		const { setAnalyticsEnabled } = await import("./consent");
		setAnalyticsEnabled(false);
		expect(
			beforeSend({ type: "pageview", url: "https://www.highelollms.com/new" }),
		).toBeNull();
	});
});
