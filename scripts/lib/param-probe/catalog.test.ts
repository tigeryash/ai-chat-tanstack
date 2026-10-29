import { describe, expect, it } from "vitest";
import { normalizeCatalog } from "./catalog";

describe("normalizeCatalog", () => {
	it("reads the slim models.list shape", () => {
		const models = normalizeCatalog({
			models: [
				{
					gatewayId: "a/top",
					openRouterId: "a/top-or",
					highElo: true,
					pricing: { input: 1, output: 2 },
				},
				{ gatewayId: "b/other", highElo: false },
			],
		});
		expect(models).toEqual([
			{
				gatewayId: "a/top",
				openRouterId: "a/top-or",
				pricing: { input: 1, output: 2 },
				highElo: true,
			},
			{
				gatewayId: "b/other",
				openRouterId: undefined,
				pricing: undefined,
				highElo: false,
			},
		]);
	});

	it("computes the High Elo set from whole rows of an older deployment", () => {
		const models = normalizeCatalog({
			models: [
				{
					gatewayId: "a/pinned",
					pinned: true,
					status: "active",
					openRouter: { id: "a/pinned" },
				},
				{
					gatewayId: "b/scored",
					status: "active",
					artificialAnalysis: { modelId: "b", intelligenceIndex: 70 },
				},
				{
					gatewayId: "c/hidden",
					hidden: true,
					status: "active",
					artificialAnalysis: { modelId: "c", intelligenceIndex: 90 },
				},
				{ gatewayId: "d/unscored", status: "active" },
			],
		});
		expect(models.filter((m) => m.highElo).map((m) => m.gatewayId)).toEqual([
			"a/pinned",
			"b/scored",
		]);
		expect(models[0].openRouterId).toBe("a/pinned");
	});

	it("accepts a bare array and refuses anything else", () => {
		expect(
			normalizeCatalog([{ gatewayId: "a/x", highElo: true }]),
		).toHaveLength(1);
		expect(() => normalizeCatalog({ nope: 1 })).toThrow("no models array");
	});
});
