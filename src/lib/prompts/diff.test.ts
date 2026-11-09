import { describe, expect, it } from "vitest";
import { diffLines, diffStats } from "./diff";

describe("diffLines", () => {
	it("marks kept, removed and added lines", () => {
		const lines = diffLines(
			"You are terse.\nUse lists.\nNo emoji.",
			"You are terse.\nUse tables.\nNo emoji.\nCite sources.",
		);
		expect(lines).toEqual([
			{ kind: "same", text: "You are terse." },
			{ kind: "removed", text: "Use lists." },
			{ kind: "added", text: "Use tables." },
			{ kind: "same", text: "No emoji." },
			{ kind: "added", text: "Cite sources." },
		]);
		expect(diffStats(lines)).toEqual({ added: 2, removed: 1 });
	});

	it("handles empty sides and identical text", () => {
		expect(diffLines("", "a")).toEqual([{ kind: "added", text: "a" }]);
		expect(diffLines("a", "")).toEqual([{ kind: "removed", text: "a" }]);
		expect(diffLines("a\nb", "a\nb").every((l) => l.kind === "same")).toBe(
			true,
		);
	});

	it("falls back to remove-all, add-all for huge inputs", () => {
		const before = Array.from({ length: 3000 }, (_, i) => `a${i}`).join("\n");
		const after = Array.from({ length: 3000 }, (_, i) => `b${i}`).join("\n");
		expect(diffStats(diffLines(before, after))).toEqual({
			added: 3000,
			removed: 3000,
		});
	});
});
