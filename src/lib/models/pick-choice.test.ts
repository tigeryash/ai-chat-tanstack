import { describe, expect, it } from "vitest";
import type { ModelChoice } from "@/lib/chat/model-selection";
import { pickedChoice } from "./pick-choice";

const pinned: ModelChoice = {
	provider: "fireworks",
	model: "fw/model",
	gatewayId: "dev/model",
	autoHost: false,
};

describe("pickedChoice", () => {
	it("keeps the host settings when the same model is picked again", () => {
		expect(
			pickedChoice(
				{ provider: "openrouter", model: "dev/model", gatewayId: "dev/model" },
				pinned,
			),
		).toBe(pinned);
	});

	it("starts another catalog model on Auto", () => {
		expect(
			pickedChoice(
				{ provider: "openrouter", model: "x/y", gatewayId: "x/y" },
				pinned,
			),
		).toEqual({
			provider: "openrouter",
			model: "x/y",
			gatewayId: "x/y",
			autoHost: true,
		});
	});

	it("leaves a local model as it is", () => {
		const local: ModelChoice = { provider: "local", model: "m", endpoint: "e" };
		expect(pickedChoice(local, pinned)).toBe(local);
	});
});
