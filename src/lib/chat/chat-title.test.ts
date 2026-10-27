import { describe, expect, it } from "vitest";
import { textMessage } from "@/lib/storage/test-support";
import { TITLE_MAX_LENGTH, titleFromMessages } from "./chat-title";

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
		expect(title).toHaveLength(TITLE_MAX_LENGTH);
		expect(title.endsWith("…")).toBe(true);
	});
});
