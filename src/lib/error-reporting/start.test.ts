import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Sentry SDK must never load (or start) without a DSN or while analytics are off.
const loaded = vi.fn();
const initSentry = vi.fn();
const captureError = vi.fn();
vi.mock("./sentry", () => {
	loaded();
	return { initSentry, captureError };
});

const { reportError, resetErrorReportingForTests, startErrorReporting } =
	await import("./start");

const DSN = "https://publickey@o1.ingest.us.sentry.io/2";

describe("startErrorReporting", () => {
	beforeEach(() => {
		resetErrorReportingForTests();
		vi.resetModules();
		loaded.mockClear();
		initSentry.mockClear();
		captureError.mockClear();
	});
	afterEach(() => resetErrorReportingForTests());

	it("never loads the SDK without a DSN", async () => {
		expect(await startErrorReporting(undefined, "production", () => true)).toBe(
			false,
		);
		reportError(new Error("boom"));
		expect(loaded).not.toHaveBeenCalled();
		expect(initSentry).not.toHaveBeenCalled();
		expect(captureError).not.toHaveBeenCalled();
	});

	it("never loads the SDK while analytics are off", async () => {
		expect(await startErrorReporting(DSN, "production", () => false)).toBe(
			false,
		);
		reportError(new Error("boom"));
		expect(loaded).not.toHaveBeenCalled();
		expect(initSentry).not.toHaveBeenCalled();
	});

	it("is off by default in Node, where analytics are never allowed", async () => {
		expect(await startErrorReporting(DSN, "production")).toBe(false);
		expect(loaded).not.toHaveBeenCalled();
	});

	it("starts once with a DSN and analytics allowed, then reports caught errors", async () => {
		expect(await startErrorReporting(DSN, "production", () => true)).toBe(true);
		expect(await startErrorReporting(DSN, "production", () => true)).toBe(true);
		expect(initSentry).toHaveBeenCalledTimes(1);
		expect(initSentry).toHaveBeenCalledWith(DSN, "production");
		const error = new Error("boom");
		reportError(error);
		await vi.waitFor(() => expect(captureError).toHaveBeenCalledWith(error));
	});
});
