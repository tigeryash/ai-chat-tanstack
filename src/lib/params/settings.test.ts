import { describe, expect, it } from "vitest";
import { parseRequestSettings } from "./request";
import { cleanSettings, withParam, withSystemPrompt } from "./settings";
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

	it("keeps a prompt's source only with its prompt (roadmap 3.6b)", () => {
		const source = { promptId: "p", version: 2 };
		expect(
			cleanSettings({
				params: {},
				systemPrompt: "Hi",
				systemPromptSource: source,
			}),
		).toEqual({ params: {}, systemPrompt: "Hi", systemPromptSource: source });
		expect(cleanSettings({ params: {}, systemPromptSource: source })).toEqual({
			params: {},
		});
		expect(
			cleanSettings({
				params: {},
				systemPrompt: "Hi",
				systemPromptSource: { promptId: "p" },
			}),
		).toEqual({ params: {}, systemPrompt: "Hi" });
	});

	it("drops the source when the prompt is edited by hand", () => {
		const applied = {
			params: { seed: 1 },
			systemPrompt: "Hi",
			systemPromptSource: { promptId: "p", version: 2 },
		};
		expect(withSystemPrompt(applied, "Hi")).toEqual(applied);
		expect(withSystemPrompt(applied, "Hello")).toEqual({
			params: { seed: 1 },
			systemPrompt: "Hello",
		});
		expect(withSystemPrompt(applied, " ")).toEqual({ params: { seed: 1 } });
	});

	it("passes a request's prompt source on only with a prompt", () => {
		const source = { promptId: "p", version: 1 };
		expect(
			parseRequestSettings({
				params: {},
				systemPrompt: "Hi",
				promptSource: source,
			}),
		).toMatchObject({ systemPrompt: "Hi", promptSource: source });
		expect(
			parseRequestSettings({ params: {}, promptSource: source }),
		).not.toHaveProperty("promptSource");
	});
});
