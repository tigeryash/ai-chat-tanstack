import { describe, expect, it } from "vitest";
import { applyPrompt } from "./apply";
import { newPrompt, withText } from "./prompt";

const prompt = withText(
	newPrompt({
		id: "p",
		ownerId: null,
		name: "P",
		tags: [],
		text: "One",
		now: 1,
	}),
	"Two",
	2,
);

describe("applyPrompt", () => {
	it("sets the current text as the chat's prompt, keeping its params", () => {
		const settings = { params: { temperature: 0.3 }, systemPrompt: "Old" };
		expect(applyPrompt(settings, prompt)).toEqual({
			params: { temperature: 0.3 },
			systemPrompt: "Two",
			systemPromptSource: { promptId: "p", version: 2 },
		});
		expect(settings.systemPrompt).toBe("Old");
	});

	it("applies an older version on request", () => {
		expect(applyPrompt({ params: {} }, prompt, 1)).toMatchObject({
			systemPrompt: "One",
			systemPromptSource: { promptId: "p", version: 1 },
		});
		expect(() => applyPrompt({ params: {} }, prompt, 5)).toThrow();
	});
});
