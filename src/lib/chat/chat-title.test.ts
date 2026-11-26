import { describe, expect, it } from "vitest";
import { textMessage } from "@/lib/storage/test-support";
import { titleFromMessages } from "./chat-title";

describe("titleFromMessages", () => {
	it("uses the first non-empty line of the first user message", () => {
		expect(
			titleFromMessages([
				textMessage("s", "system", "You are helpful"),
				textMessage("u1", "user", "\n  Plan a trip  \nto Lisbon"),
				textMessage("u2", "user", "later"),
			]),
		).toBe("Plan a trip");
	});

	it("is empty when there's no user text", () => {
		expect(titleFromMessages([])).toBe("");
		expect(titleFromMessages([textMessage("u", "user", "  \n ")])).toBe("");
	});

	it("shortens long lines", () => {
		const title = titleFromMessages([
			textMessage("u", "user", "a".repeat(500)),
		]);
		expect(title).toHaveLength(80);
		expect(title.endsWith("…")).toBe(true);
	});
});
