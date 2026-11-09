import { describe, expect, it } from "vitest";
import {
	currentVersion,
	MAX_VERSIONS,
	newPrompt,
	normalizeName,
	type Prompt,
	parseTags,
	readPrompt,
	withLabels,
	withRestored,
	withText,
} from "./prompt";

const base = (): Prompt =>
	newPrompt({
		id: "p1",
		ownerId: null,
		name: "  Reviewer  ",
		tags: ["Code", "#code", " tone "],
		text: "Be terse.",
		now: 10,
	});

describe("prompt versions", () => {
	it("starts at version 1 with clean labels", () => {
		const prompt = base();
		expect(prompt.name).toBe("Reviewer");
		expect(prompt.tags).toEqual(["code", "tone"]);
		expect(prompt.versions).toEqual([
			{ version: 1, text: "Be terse.", createdAt: 10 },
		]);
	});

	it("makes every text edit a version, and ignores an unchanged save", () => {
		const v2 = withText(base(), "Be kind.", 20);
		expect(currentVersion(v2)).toEqual({
			version: 2,
			text: "Be kind.",
			createdAt: 20,
		});
		expect(v2.updatedAt).toBe(20);
		expect(withText(v2, "Be kind.", 30)).toBe(v2);
	});

	it("restores by adding the old text as the newest version", () => {
		const v3 = withText(withText(base(), "Two", 20), "Three", 30);
		const restored = withRestored(v3, 1, 40);
		expect(restored.versions.map((v) => v.text)).toEqual([
			"Be terse.",
			"Two",
			"Three",
			"Be terse.",
		]);
		expect(currentVersion(restored)).toMatchObject({
			version: 4,
			restoredFrom: 1,
		});
		// Restoring what's already current adds nothing; a missing version throws.
		expect(withRestored(restored, 1, 50)).toBe(restored);
		expect(() => withRestored(restored, 9, 50)).toThrow();
	});

	it("keeps the newest MAX_VERSIONS, numbering on", () => {
		let prompt = base();
		for (let i = 0; i < MAX_VERSIONS + 5; i++) {
			prompt = withText(prompt, `text ${i}`, 100 + i);
		}
		expect(prompt.versions).toHaveLength(MAX_VERSIONS);
		expect(currentVersion(prompt).version).toBe(MAX_VERSIONS + 6);
		expect(() => readPrompt(prompt)).not.toThrow();
	});

	it("renames and retags without a version", () => {
		const prompt = withLabels(base(), { name: "", tags: ["A", "a"] }, 99);
		expect(prompt.name).toBe("Untitled prompt");
		expect(prompt.tags).toEqual(["a"]);
		expect(prompt.versions).toHaveLength(1);
		expect(
			withLabels(prompt, { name: "Untitled prompt", tags: ["a"] }, 100),
		).toBe(prompt);
	});
});

describe("labels", () => {
	it("parses comma-separated tags", () => {
		expect(parseTags("Writing, code review, #tone, , writing")).toEqual([
			"writing",
			"code-review",
			"tone",
		]);
	});

	it("collapses whitespace in names", () => {
		expect(normalizeName(" a \n b ")).toBe("a b");
	});
});

describe("readPrompt", () => {
	it("rejects newer formats and bad records", () => {
		expect(() => readPrompt({ ...base(), formatVersion: 99 })).toThrow(
			/newer version/,
		);
		expect(() => readPrompt({ ...base(), versions: [] })).toThrow(/invalid/);
		const prompt = base();
		expect(() =>
			readPrompt({
				...prompt,
				versions: [
					{ version: 2, text: "b", createdAt: 1 },
					{ version: 1, text: "a", createdAt: 1 },
				],
			}),
		).toThrow(/invalid/);
	});
});
