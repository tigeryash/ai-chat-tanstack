import { describe, expect, it } from "vitest";
import { pageRoute, sanitizePageUrl } from "./page-url";

describe("pageRoute", () => {
	it.each([
		["/", "/"],
		["/new", "/new"],
		["/settings/", "/settings"],
		["/login", "/login"],
		["/reset-password", "/reset-password"],
		["/privacy", "/privacy"],
		["/terms", "/terms"],
		["/0f3a9c1e-chat-id", "/[chatId]"],
		["/e2e/chat", "/e2e"],
		["/some/deeper/path", "/[other]"],
	])("%s → %s", (path, route) => {
		expect(pageRoute(path)).toBe(route);
	});
});

describe("sanitizePageUrl", () => {
	it("drops query strings and fragments (OAuth codes, reset tokens)", () => {
		expect(
			sanitizePageUrl(
				"https://www.highelollms.com/settings?code=abc&state=xyz",
			),
		).toBe("https://www.highelollms.com/settings");
		expect(
			sanitizePageUrl("https://www.highelollms.com/reset-password?token=t0k#x"),
		).toBe("https://www.highelollms.com/reset-password");
	});

	it("replaces a chat's id with [chatId]", () => {
		expect(sanitizePageUrl("https://www.highelollms.com/abc123")).toBe(
			"https://www.highelollms.com/[chatId]",
		);
	});

	it("returns null for something that isn't a URL", () => {
		expect(sanitizePageUrl("not a url")).toBeNull();
	});
});
