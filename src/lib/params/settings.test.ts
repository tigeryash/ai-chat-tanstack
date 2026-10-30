import { describe, expect, it } from "vitest";
import { parseRequestSettings } from "./request";
import { cleanSettings, withParam } from "./settings";
import { NO_SUPPORT } from "./support";

describe("settings", () => {
	it("keeps valid values and drops the rest", () => {
		expect(
			cleanSettings({
				params: {
					temperature: 0.7,
					topP: 3,
					topK: 2.5,
					reasoningEffort: "turbo",
					verbosity: "low",
					stopSequences: ["a", ""],
				},
				systemPrompt: "Hi",
			}),
		).toEqual({
			params: { temperature: 0.7, verbosity: "low" },
			systemPrompt: "Hi",
		});
		expect(cleanSettings("nope")).toEqual({ params: {} });
	});

	it("sets and unsets one value without touching the others", () => {
		const start = { temperature: 1, seed: 2 };
		expect(withParam(start, "seed", undefined)).toEqual({ temperature: 1 });
		expect(withParam(start, "topK", 5)).toEqual({ ...start, topK: 5 });
		expect(start).toEqual({ temperature: 1, seed: 2 });
	});

	it("reads a request's settings, with no support when it's missing", () => {
		expect(parseRequestSettings(undefined)).toEqual({
			params: {},
			support: NO_SUPPORT,
		});
		expect(
			parseRequestSettings({
				params: { seed: 1 },
				support: { params: ["seed"], reasoningEfforts: [] },
				systemPrompt: "  ",
			}),
		).toEqual({
			params: { seed: 1 },
			support: { params: ["seed"], reasoningEfforts: [] },
		});
	});
});
