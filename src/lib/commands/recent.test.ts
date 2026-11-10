import { describe, expect, it } from "vitest";
import { MAX_RECENT_COMMANDS, withRecent } from "./recent";

describe("withRecent", () => {
	it("moves the command to the front without repeating it", () => {
		expect(withRecent(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
		expect(withRecent([], "a")).toEqual(["a"]);
	});

	it("keeps at most the limit", () => {
		const ids = Array.from({ length: MAX_RECENT_COMMANDS }, (_, i) => `c${i}`);
		const next = withRecent(ids, "new");
		expect(next).toHaveLength(MAX_RECENT_COMMANDS);
		expect(next[0]).toBe("new");
		expect(next).not.toContain(`c${MAX_RECENT_COMMANDS - 1}`);
	});
});
