// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
	MODEL_CHOICE_STORAGE_KEY,
	readModelChoice,
	storeModelChoice,
	toSelection,
} from "./model-selection";

describe("model choice", () => {
	it("is remembered in localStorage, and needs a model to send", () => {
		expect(readModelChoice()).toBeNull();
		storeModelChoice({ provider: "openrouter", model: "" });
		expect(toSelection(readModelChoice())).toBeUndefined();

		storeModelChoice({ provider: "openrouter", model: " google/gemma " });
		expect(
			JSON.parse(localStorage.getItem(MODEL_CHOICE_STORAGE_KEY) ?? ""),
		).toEqual({ provider: "openrouter", model: "google/gemma" });
		expect(toSelection(readModelChoice())).toEqual({
			provider: "openrouter",
			model: "google/gemma",
		});
	});

	it("rejects unknown providers", () => {
		expect(toSelection({ provider: "evil", model: "x" } as never)).toBe(
			undefined,
		);
	});
});
