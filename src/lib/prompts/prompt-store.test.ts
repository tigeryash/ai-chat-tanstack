// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { openTestDatabase, tickingClock } from "@/lib/storage/test-support";
import { currentVersion } from "./prompt";
import { createDexiePromptStore } from "./prompt-store";

function setup() {
	const db = openTestDatabase();
	let n = 0;
	const store = createDexiePromptStore({
		db,
		now: tickingClock(),
		newId: () => `prompt-${++n}`,
	});
	return { db, store };
}

describe("DexiePromptStore", () => {
	it("saves, edits, restores and survives a reopen", async () => {
		const { db, store } = setup();
		const created = await store.createPrompt({
			name: "Reviewer",
			tags: ["Code"],
			text: "v1",
			ownerId: null,
		});
		await store.saveText(created.id, "v2");
		await store.saveText(created.id, "v2");
		await store.restoreVersion(created.id, 1);
		await store.setLabels(created.id, {
			name: "Strict reviewer",
			tags: ["code", "strict"],
		});

		const reopened = createDexiePromptStore({ db });
		const prompt = await reopened.getPrompt(created.id);
		expect(prompt?.name).toBe("Strict reviewer");
		expect(prompt?.tags).toEqual(["code", "strict"]);
		expect(prompt?.versions.map((v) => [v.version, v.text])).toEqual([
			[1, "v1"],
			[2, "v2"],
			[3, "v1"],
		]);
		expect(prompt && currentVersion(prompt).restoredFrom).toBe(1);
	});

	it("lists newest first, skipping unreadable rows", async () => {
		const { db, store } = setup();
		const a = await store.createPrompt({
			name: "A",
			tags: [],
			text: "a",
			ownerId: null,
		});
		await store.createPrompt({ name: "B", tags: [], text: "b", ownerId: "u" });
		await store.saveText(a.id, "a2");
		await db.prompts.put({ id: "bad", formatVersion: 1 } as never);
		expect((await store.listPrompts()).map((p) => p.name)).toEqual(["A", "B"]);
	});

	it("refuses unknown prompts, versions and too-long text", async () => {
		const { store } = setup();
		await expect(store.saveText("nope", "x")).rejects.toThrow(/No such prompt/);
		const p = await store.createPrompt({
			name: "A",
			tags: [],
			text: "a",
			ownerId: null,
		});
		await expect(store.restoreVersion(p.id, 7)).rejects.toThrow();
		await expect(store.saveText(p.id, "x".repeat(50_001))).rejects.toThrow();
		expect((await store.getPrompt(p.id))?.versions).toHaveLength(1);
	});

	it("moves owners and deletes", async () => {
		const { store } = setup();
		const p = await store.createPrompt({
			name: "A",
			tags: [],
			text: "a",
			ownerId: null,
		});
		await store.setPromptOwner([p.id, "missing"], "user-a");
		expect((await store.getPrompt(p.id))?.ownerId).toBe("user-a");
		await store.deletePrompt(p.id);
		await store.deletePrompt(p.id);
		expect(await store.listPrompts()).toEqual([]);
	});
});
