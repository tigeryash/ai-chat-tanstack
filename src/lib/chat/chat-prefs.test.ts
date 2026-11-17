// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const KEY = "highelo-chat-prefs";

// A fresh module per test, so each reads localStorage anew.
async function load() {
	vi.resetModules();
	return import("./chat-prefs");
}

afterEach(() => localStorage.clear());

describe("chat prefs", () => {
	it("starts with the defaults", async () => {
		const { readChatPrefs, DEFAULT_CHAT_PREFS } = await load();
		expect(readChatPrefs()).toEqual(DEFAULT_CHAT_PREFS);
		expect(DEFAULT_CHAT_PREFS).toEqual({
			contextWarnings: true,
			inlineStats: "none",
			reasoning: "while-thinking",
			syncScroll: false,
			newPanesSynced: true,
		});
	});

	it("keeps an older saved value's choices and fills in the new fields", async () => {
		localStorage.setItem(KEY, JSON.stringify({ contextWarnings: false }));
		const { readChatPrefs } = await load();
		expect(readChatPrefs()).toMatchObject({
			contextWarnings: false,
			inlineStats: "none",
			newPanesSynced: true,
		});
	});

	it("saves a change and keeps the rest", async () => {
		const { readChatPrefs, updateChatPrefs } = await load();
		updateChatPrefs({ inlineStats: "all", syncScroll: true });
		expect(readChatPrefs()).toMatchObject({
			contextWarnings: true,
			inlineStats: "all",
			syncScroll: true,
		});
		expect(JSON.parse(localStorage.getItem(KEY) ?? "{}")).toMatchObject({
			inlineStats: "all",
		});
	});

	it("falls back to the defaults for an unknown choice", async () => {
		localStorage.setItem(KEY, JSON.stringify({ reasoning: "sideways" }));
		const { readChatPrefs, DEFAULT_CHAT_PREFS } = await load();
		expect(readChatPrefs()).toEqual(DEFAULT_CHAT_PREFS);
	});
});
