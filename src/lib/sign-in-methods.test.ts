import { describe, expect, it } from "vitest";
import { initialsOf, signInMethodStatuses } from "./sign-in-methods";

describe("signInMethodStatuses", () => {
	it("lists every method in order, marking the linked ones", () => {
		expect(signInMethodStatuses(["github", "credential"])).toEqual([
			{ providerId: "credential", label: "Email and password", linked: true },
			{ providerId: "google", label: "Google", linked: false },
			{ providerId: "github", label: "GitHub", linked: true },
			{ providerId: "discord", label: "Discord", linked: false },
		]);
	});

	it("ignores providers the app doesn't offer", () => {
		expect(
			signInMethodStatuses(["twitter"]).filter((method) => method.linked),
		).toEqual([]);
	});
});

describe("initialsOf", () => {
	it("takes the first letters of the first two words", () => {
		expect(initialsOf("ada lovelace byron", "a@example.com")).toBe("AL");
		expect(initialsOf("Ada", "a@example.com")).toBe("A");
	});

	it("falls back to the email, then a question mark", () => {
		expect(initialsOf("  ", "zed@example.com")).toBe("Z");
		expect(initialsOf("", "")).toBe("?");
	});
});
