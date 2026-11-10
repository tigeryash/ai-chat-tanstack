import { describe, expect, it } from "vitest";
import { modelDefaultPrompt, resolveSystemPrompt } from "./defaults";
import { newPrompt, type Prompt, withDefaultFor, withText } from "./prompt";

function prompt(id: string, text: string, updatedAt = 1): Prompt {
	return {
		...newPrompt({ id, ownerId: null, name: id, tags: [], text, now: 1 }),
		updatedAt,
	};
}

const reviewer = withDefaultFor(
	withText(prompt("reviewer", "v1"), "v2", 2),
	"openai/gpt-x",
	true,
);

describe("modelDefaultPrompt", () => {
	it("finds the prompt that is the model's default", () => {
		const prompts = [prompt("other", "x"), reviewer];
		expect(modelDefaultPrompt(prompts, "openai/gpt-x")?.id).toBe("reviewer");
		expect(modelDefaultPrompt(prompts, "anthropic/claude")).toBeUndefined();
		expect(modelDefaultPrompt(prompts, undefined)).toBeUndefined();
	});

	it("picks the most recently changed one when two claim a model", () => {
		const older = withDefaultFor(prompt("older", "a", 1), "m", true);
		const newer = withDefaultFor(prompt("newer", "b", 5), "m", true);
		expect(modelDefaultPrompt([older, newer], "m")?.id).toBe("newer");
	});
});

describe("resolveSystemPrompt", () => {
	it("prefers the chat's own prompt, keeping where it came from", () => {
		expect(
			resolveSystemPrompt({
				own: "Mine",
				ownSource: { promptId: "p", version: 3 },
				modelDefault: reviewer,
				shared: "Shared",
			}),
		).toEqual({
			text: "Mine",
			from: "chat",
			source: { promptId: "p", version: 3 },
		});
		expect(
			resolveSystemPrompt({
				own: "Hand-written",
				ownSource: undefined,
				modelDefault: reviewer,
				shared: "Shared",
			}),
		).toEqual({ text: "Hand-written", from: "chat" });
	});

	it("uses the model's default at its newest version next", () => {
		expect(
			resolveSystemPrompt({
				own: undefined,
				ownSource: undefined,
				modelDefault: reviewer,
				shared: "Shared",
			}),
		).toEqual({
			text: "v2",
			from: "model-default",
			source: { promptId: "reviewer", version: 2 },
		});
	});

	it("falls back to the shared prompt, which has no source, then none", () => {
		const base = {
			own: undefined,
			ownSource: undefined,
			modelDefault: undefined,
		};
		expect(resolveSystemPrompt({ ...base, shared: "Shared" })).toEqual({
			text: "Shared",
			from: "shared",
		});
		expect(resolveSystemPrompt({ ...base, shared: "  " })).toEqual({
			text: "",
			from: "none",
		});
	});
});
