// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ANALYTICS_SETTINGS_KEY,
	analyticsAllowed,
	analyticsSettings,
	browserAsksNotToTrack,
	setAnalyticsEnabled,
} from "./consent";
import {
	type AnalyticsSink,
	clearRecordedEvents,
	createTracker,
	recordedEvents,
	sanitizeEvent,
	track,
} from "./track";

// The allowlist is typed, so these tests call it the way a mistake or a future caller might: with
// names and properties the types would reject.
const untyped = sanitizeEvent as (
	name: string,
	properties: unknown,
) => ReturnType<typeof sanitizeEvent>;

describe("sanitizeEvent", () => {
	it("keeps an allowlisted event with valid properties", () => {
		expect(
			untyped("chat_sent", { providerKind: "local", hasAttachment: false }),
		).toEqual({
			name: "chat_sent",
			properties: { providerKind: "local", hasAttachment: false },
		});
	});

	it("drops events that aren't on the allowlist", () => {
		expect(untyped("prompt_typed", { text: "hello" })).toBeNull();
		expect(untyped("toString", {})).toBeNull();
		expect(untyped("__proto__", {})).toBeNull();
	});

	it("drops properties the event's schema doesn't name", () => {
		expect(
			untyped("key_connected", {
				provider: "openai",
				key: "sk-proj-abcdefghijklmnopqrstuvwxyz0123",
				last4: "0123",
			}),
		).toEqual({ name: "key_connected", properties: { provider: "openai" } });
	});

	it("drops the event when a property has the wrong type or value", () => {
		expect(untyped("key_connected", { provider: "not-a-provider" })).toBeNull();
		expect(
			untyped("local_endpoint_added", { kind: "http://localhost:1234" }),
		).toBeNull();
		expect(
			untyped("chat_sent", { providerKind: "hosted", hasAttachment: "no" }),
		).toBeNull();
		expect(
			untyped("chat_sent", {
				providerKind: "hosted",
				hasAttachment: false,
				paneCount: 1.5,
			}),
		).toBeNull();
	});

	it.each([
		["a prompt", "Summarize my medical records please"],
		["a chat title", "Plans for Q3"],
		["a URL", "https://example.com/?q=secret"],
		["a long slug", "a".repeat(41)],
		["uppercase", "OpenAI"],
		["an empty string", ""],
	])("lets no free text through a slug property (%s)", (_, developer) => {
		expect(untyped("model_picked", { developer, highElo: true })).toBeNull();
	});

	it("drops a slug-shaped value that redact() recognizes as a key", () => {
		expect(
			untyped("model_picked", {
				developer: "sk-abcdefghijklmnopqrstuvwx",
				highElo: false,
			}),
		).toBeNull();
	});

	it("drops nested objects and arrays", () => {
		expect(
			untyped("model_picked", { developer: { name: "x" }, highElo: true }),
		).toBeNull();
		expect(untyped("model_picked", ["openai", true])).toBeNull();
	});
});

describe("createTracker", () => {
	it("sends allowed events to the sink and nothing else", () => {
		const sink = vi.fn<AnalyticsSink>();
		const send = createTracker({ allowed: () => true, sink });
		send("model_picked", { developer: "openai", highElo: true });
		(send as (name: string, properties: unknown) => void)("secret_event", {});
		expect(sink).toHaveBeenCalledTimes(1);
		expect(sink).toHaveBeenCalledWith({
			name: "model_picked",
			properties: { developer: "openai", highElo: true },
		});
	});

	it("is a no-op while analytics are off", () => {
		const sink = vi.fn<AnalyticsSink>();
		const send = createTracker({ allowed: () => false, sink });
		send("chat_sent", { providerKind: "hosted", hasAttachment: false });
		expect(sink).not.toHaveBeenCalled();
	});

	it("never throws, even when the sink does", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const send = createTracker({
			allowed: () => true,
			sink: () => {
				throw new Error("blocked by an ad blocker");
			},
		});
		expect(() =>
			send("key_connected", { provider: "anthropic" }),
		).not.toThrow();
	});
});

describe("track() and the opt-out", () => {
	beforeEach(() => {
		localStorage.clear();
		analyticsSettings.write({ enabled: true });
		clearRecordedEvents();
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("records events in dev and test builds instead of sending them", () => {
		track("local_endpoint_added", { kind: "ollama" });
		expect(recordedEvents()).toEqual([
			{ name: "local_endpoint_added", properties: { kind: "ollama" } },
		]);
	});

	it("is on by default and does nothing once switched off", () => {
		expect(analyticsAllowed()).toBe(true);
		setAnalyticsEnabled(false);
		expect(localStorage.getItem(ANALYTICS_SETTINGS_KEY)).toBe(
			'{"enabled":false}',
		);
		track("chat_sent", { providerKind: "hosted", hasAttachment: false });
		expect(recordedEvents()).toEqual([]);
	});

	it.each([
		["Global Privacy Control", { globalPrivacyControl: true }],
		["Do Not Track", { doNotTrack: "1" }],
	])("treats %s as switched off", (_, signals) => {
		expect(browserAsksNotToTrack(signals)).toBe(true);
		vi.stubGlobal("navigator", { ...navigator, ...signals });
		expect(analyticsAllowed()).toBe(false);
		track("key_connected", { provider: "openai" });
		expect(recordedEvents()).toEqual([]);
	});

	it("ignores Do Not Track when it's unset or 0", () => {
		expect(browserAsksNotToTrack({ doNotTrack: "0" })).toBe(false);
		expect(browserAsksNotToTrack({ doNotTrack: null })).toBe(false);
		expect(browserAsksNotToTrack({})).toBe(false);
	});
});
