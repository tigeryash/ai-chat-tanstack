import { describe, expect, it } from "vitest";
import { contrastRatio, parseColor, toHex } from "./color";

describe("parseColor", () => {
	it("reads hex and oklch, and round-trips through hex", () => {
		expect(toHex(parseColor("#3366cc") ?? fail())).toBe("#3366cc");
		expect(toHex(parseColor("oklch(1 0 0)") ?? fail())).toBe("#ffffff");
		expect(toHex(parseColor("oklch(0 0 0)") ?? fail())).toBe("#000000");
		// oklch(0.628 0.2577 29.23) is sRGB red.
		expect(toHex(parseColor("oklch(62.8% 0.2577 29.23deg)") ?? fail())).toBe(
			"#ff0000",
		);
	});

	it("ignores alpha and rejects what isn't a plain color", () => {
		expect(parseColor("oklch(0 0 0 / 0.1)")).not.toBeNull();
		expect(parseColor("var(--foreground)")).toBeNull();
		expect(parseColor("transparent")).toBeNull();
		expect(parseColor("#fff")).toBeNull();
	});
});

describe("contrastRatio", () => {
	it("matches WCAG's known values", () => {
		const white = parseColor("#ffffff") ?? fail();
		const black = parseColor("#000000") ?? fail();
		expect(contrastRatio(white, black)).toBeCloseTo(21, 5);
		expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
		// #767676 on white is the classic 4.54:1.
		expect(contrastRatio(parseColor("#767676") ?? fail(), white)).toBeCloseTo(
			4.54,
			2,
		);
	});
});

function fail(): never {
	throw new Error("expected a color");
}
