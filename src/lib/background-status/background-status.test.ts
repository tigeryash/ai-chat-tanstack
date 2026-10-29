// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setReplying } from "./activity";
import { startBackgroundStatus } from "./background-status";

let hidden = false;
function setHidden(value: boolean) {
	hidden = value;
	document.dispatchEvent(new Event("visibilitychange"));
}

const icon = () =>
	document
		.querySelector<HTMLLinkElement>('link[rel~="icon"]')
		?.getAttribute("href");

function start(prefersReducedMotion: boolean) {
	return startBackgroundStatus({
		openChat: () => {},
		chatTitle: async () => "",
		offerNotifications: () => {},
		prefersReducedMotion: () => prefersReducedMotion,
	});
}

describe("background status favicon", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		hidden = false;
		Object.defineProperty(document, "hidden", {
			configurable: true,
			get: () => hidden,
		});
		document.title = "High Elo LLMs";
	});
	afterEach(() => {
		setReplying("chat-1", false);
		vi.useRealTimers();
	});

	it("pulses while replying, and restores title and icon when shown", () => {
		const stop = start(false);
		setHidden(true);
		setReplying("chat-1", true);
		expect(document.title).toBe("● Replying — High Elo LLMs");
		const first = icon();
		vi.advanceTimersByTime(1000);
		expect(icon()).not.toBe(first);

		setHidden(false);
		expect(document.title).toBe("High Elo LLMs");
		expect(icon()).toBe("/favicon.ico");
		stop();
	});

	it("holds a still icon with reduced motion", () => {
		const stop = start(true);
		setHidden(true);
		setReplying("chat-1", true);
		const first = icon();
		expect(first).toMatch(/^data:image\/svg\+xml,/);
		vi.advanceTimersByTime(5000);
		expect(icon()).toBe(first);
		stop();
	});
});
