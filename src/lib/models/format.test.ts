import { describe, expect, it } from "vitest";
import {
	formatCost,
	formatCostExact,
	formatCutoff,
	formatMonth,
	formatPrice,
	formatTokens,
} from "./format";

describe("model formats", () => {
	it("shortens token counts", () => {
		expect(formatTokens(1_000_000)).toBe("1M");
		expect(formatTokens(1_048_576)).toBe("1M");
		expect(formatTokens(2_500_000)).toBe("2.5M");
		expect(formatTokens(200_000)).toBe("200K");
		expect(formatTokens(undefined)).toBeUndefined();
	});

	it("prices per million tokens", () => {
		expect(formatPrice(3)).toBe("$3");
		expect(formatPrice(0.25)).toBe("$0.25");
		expect(formatPrice(0.075)).toBe("$0.075");
		expect(formatPrice(0)).toBe("Free");
	});

	it("dates by month", () => {
		expect(formatMonth(Date.UTC(2026, 7, 5))).toBe("Aug 2026");
		expect(formatCutoff("2025-04")).toBe("Apr 2025");
		expect(formatCutoff("2025-07-31")).toBe("Jul 2025");
		expect(formatCutoff("early 2025")).toBe("early 2025");
	});
});

describe("formatCost", () => {
	it("rounds to a tenth of a cent's tenth, with a floor", () => {
		expect(
			[0.00021, 0.000021, 0.00016, 0.0012, 0.0099, 0.00999, 0.42, 3.5, 0].map(
				formatCost,
			),
		).toEqual([
			"$0.0002",
			"<$0.0001",
			"$0.0002",
			"$0.0012",
			"$0.0099",
			"$0.01",
			"$0.42",
			"$3.50",
			"$0",
		]);
	});

	it("keeps two significant digits below a cent in the exact form", () => {
		expect(
			[0.000021, 0.00000344, 0.0012, 0.0099, 0.42, 3.5, 0.0000001, 0].map(
				formatCostExact,
			),
		).toEqual([
			"$0.000021",
			"$0.0000034",
			"$0.0012",
			"$0.0099",
			"$0.42",
			"$3.50",
			"<$0.000001",
			"$0",
		]);
	});
});
