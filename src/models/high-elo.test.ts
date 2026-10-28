import { describe, expect, it } from "vitest";
import { type HighEloCandidate, selectHighElo } from "./high-elo";

function model(
	gatewayId: string,
	score: number | undefined,
	extra: Partial<HighEloCandidate> = {},
): HighEloCandidate {
	return {
		gatewayId,
		pinned: false,
		hidden: false,
		status: "active",
		artificialAnalysis:
			score === undefined
				? undefined
				: { modelId: `aa-${gatewayId}`, intelligenceIndex: score },
		...extra,
	};
}

describe("selectHighElo", () => {
	it("takes the top N by Intelligence Index plus every pin", () => {
		const rows = [
			model("a/low", 10),
			model("a/high", 70),
			model("a/mid", 50),
			model("a/pin", undefined, { pinned: true }),
		];
		expect([...selectHighElo(rows, 2)].sort()).toEqual([
			"a/high",
			"a/mid",
			"a/pin",
		]);
	});

	it("skips hidden, removed and unscored models", () => {
		const rows = [
			model("a/hidden", 90, { hidden: true }),
			model("a/removed", 80, { status: "removed" }),
			model("a/unscored", undefined),
			model("a/scored", 5),
		];
		expect([...selectHighElo(rows, 5)]).toEqual(["a/scored"]);
	});

	it("gives serving variants of one scored model a single slot", () => {
		const shared = { modelId: "aa-opus", intelligenceIndex: 70 };
		const rows = [
			model("a/opus", 70, { artificialAnalysis: shared, releasedAt: 2 }),
			model("a/opus-fast", 70, { artificialAnalysis: shared, releasedAt: 1 }),
			model("a/other", 60),
		];
		expect([...selectHighElo(rows, 2)]).toEqual(["a/opus", "a/other"]);
	});
});
