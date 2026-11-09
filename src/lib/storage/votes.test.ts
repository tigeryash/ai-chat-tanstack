import { describe, expect, it } from "vitest";
import { cleanVotes, MAX_VOTES, withVote } from "./votes";

describe("reply votes", () => {
	it("sets, replaces and clears a vote without changing the old object", () => {
		const first = withVote(undefined, "m1", "up");
		const second = withVote(first, "m2", "down");
		const flipped = withVote(second, "m1", "down");
		const cleared = withVote(flipped, "m2", null);
		expect(first).toEqual({ m1: "up" });
		expect(second).toEqual({ m1: "up", m2: "down" });
		expect(flipped).toEqual({ m1: "down", m2: "down" });
		expect(cleared).toEqual({ m1: "down" });
		expect(first).toEqual({ m1: "up" });
	});

	it("drops bad entries from storage or an import, keeping the good ones", () => {
		expect(
			cleanVotes({ m1: "up", m2: "sideways", "": "down", m3: 1, m4: "down" }),
		).toEqual({ m1: "up", m4: "down" });
		expect(cleanVotes({ m1: "meh" })).toBeUndefined();
		expect(cleanVotes(["up"])).toBeUndefined();
		expect(cleanVotes(null)).toBeUndefined();
		const many = Object.fromEntries(
			Array.from({ length: MAX_VOTES + 5 }, (_, i) => [`m${i}`, "up"]),
		);
		expect(Object.keys(cleanVotes(many) ?? {})).toHaveLength(MAX_VOTES);
	});
});
