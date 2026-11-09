import { describe, expect, it } from "vitest";
import { scrollRatio, scrollTopAt } from "./sync-scroll";

describe("sync scroll", () => {
	it("maps one pane's position onto another of a different length", () => {
		const short = { scrollTop: 150, scrollHeight: 400, clientHeight: 100 };
		const ratio = scrollRatio(short);
		expect(ratio).toBe(0.5);
		expect(
			scrollTopAt(
				{ scrollTop: 0, scrollHeight: 2100, clientHeight: 100 },
				ratio,
			),
		).toBe(1000);
	});

	it("treats a pane that doesn't scroll as at the top, and clamps", () => {
		expect(
			scrollRatio({ scrollTop: 0, scrollHeight: 50, clientHeight: 100 }),
		).toBe(0);
		expect(
			scrollRatio({ scrollTop: 500, scrollHeight: 200, clientHeight: 100 }),
		).toBe(1);
		expect(
			scrollTopAt({ scrollTop: 0, scrollHeight: 50, clientHeight: 100 }, 1),
		).toBe(0);
	});
});
