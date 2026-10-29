import { describe, expect, it } from "vitest";
import { notificationText } from "./notifications";
import { formatTabTitle, statusFaviconUrl, tabState } from "./tab-title";

const BASE = "High Elo LLMs";
const idle = { replying: 0, finished: 0, failed: 0 };

describe("formatTabTitle", () => {
	it("keeps the normal title with nothing going on", () => {
		expect(formatTabTitle(idle, BASE)).toBe(BASE);
	});

	it("counts replies running across chats", () => {
		expect(formatTabTitle({ ...idle, replying: 1 }, BASE)).toBe(
			"● Replying — High Elo LLMs",
		);
		expect(formatTabTitle({ ...idle, replying: 2 }, BASE)).toBe(
			"● 2 replying — High Elo LLMs",
		);
	});

	it("shows running replies before finished ones", () => {
		expect(formatTabTitle({ replying: 1, finished: 3, failed: 1 }, BASE)).toBe(
			"● Replying — High Elo LLMs",
		);
	});

	it("says Done once replies finish", () => {
		expect(formatTabTitle({ ...idle, finished: 1 }, BASE)).toBe(
			"✓ Done — High Elo LLMs",
		);
		expect(formatTabTitle({ ...idle, finished: 4 }, BASE)).toBe(
			"✓ Done — High Elo LLMs",
		);
	});

	it("puts a failure ahead of finished replies", () => {
		expect(formatTabTitle({ ...idle, finished: 2, failed: 1 }, BASE)).toBe(
			"! Reply failed — High Elo LLMs",
		);
		expect(formatTabTitle({ ...idle, failed: 2 }, BASE)).toBe(
			"! 2 replies failed — High Elo LLMs",
		);
	});
});

describe("tabState", () => {
	it("orders replying, failed, finished, idle", () => {
		expect(tabState({ replying: 1, finished: 1, failed: 1 })).toBe("replying");
		expect(tabState({ replying: 0, finished: 1, failed: 1 })).toBe("failed");
		expect(tabState({ replying: 0, finished: 1, failed: 0 })).toBe("finished");
		expect(tabState(idle)).toBe("idle");
	});
});

describe("statusFaviconUrl", () => {
	it("is an SVG data URL that differs per state and pulse frame", () => {
		const urls = [
			statusFaviconUrl("replying"),
			statusFaviconUrl("replying", true),
			statusFaviconUrl("finished"),
			statusFaviconUrl("failed"),
		];
		for (const url of urls) expect(url).toMatch(/^data:image\/svg\+xml,/);
		expect(new Set(urls).size).toBe(urls.length);
	});
});

describe("notificationText", () => {
	it("names the chat at most", () => {
		expect(notificationText("finished", "Trip planning")).toBe(
			"Reply ready in Trip planning",
		);
		expect(notificationText("failed", "Trip planning")).toBe(
			"Reply failed in Trip planning",
		);
		expect(notificationText("finished", "  ")).toBe("Reply ready");
	});
});
