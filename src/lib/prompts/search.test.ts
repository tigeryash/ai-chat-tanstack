import { describe, expect, it } from "vitest";
import { newPrompt, withText } from "./prompt";
import { allTags, searchPrompts } from "./search";

const prompts = [
	newPrompt({
		id: "a",
		ownerId: null,
		name: "Code reviewer",
		tags: ["code"],
		text: "Find bugs.",
		now: 1,
	}),
	newPrompt({
		id: "b",
		ownerId: null,
		name: "Editor",
		tags: ["writing", "tone"],
		text: "Tighten prose.",
		now: 2,
	}),
	withText(
		newPrompt({
			id: "c",
			ownerId: null,
			name: "Translator",
			tags: [],
			text: "French.",
			now: 3,
		}),
		"Translate to German.",
		4,
	),
];

const ids = (query: string) => searchPrompts(prompts, query).map((p) => p.id);

describe("searchPrompts", () => {
	it("matches name, tags and current text, newest first", () => {
		expect(ids("")).toEqual(["c", "b", "a"]);
		expect(ids("REVIEW")).toEqual(["a"]);
		expect(ids("ton")).toEqual(["b"]);
		expect(ids("german")).toEqual(["c"]);
		// Only the current version is searched.
		expect(ids("french")).toEqual([]);
	});

	it("needs every word, with # for exact tags", () => {
		expect(ids("#writing prose")).toEqual(["b"]);
		expect(ids("#writ")).toEqual([]);
		expect(ids("editor bugs")).toEqual([]);
	});

	it("lists tags", () => {
		expect(allTags(prompts)).toEqual(["code", "tone", "writing"]);
	});
});
