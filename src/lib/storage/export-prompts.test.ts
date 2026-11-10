// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createDexiePromptStore } from "@/lib/prompts/prompt-store";
import { createDexieChatStore } from "./dexie-chat-store";
import { ChatStoreError } from "./errors";
import { CHAT_EXPORT_FORMAT, exportChats, importChats } from "./export";
import { openTestDatabase, tickingClock } from "./test-support";

// Saved prompts in exports (roadmap 3.6b): versions, tags and model defaults round-trip, owners follow
// the chats' rules, and files from before prompts were exported still import.

function device(name: string) {
	const db = openTestDatabase(name);
	let n = 0;
	return {
		chats: createDexieChatStore({ db, now: tickingClock() }),
		prompts: createDexiePromptStore({
			db,
			now: tickingClock(),
			newId: () => `${name}-prompt-${++n}`,
		}),
	};
}

describe("saved prompts in exports", () => {
	it("export → wipe → import restores prompts, versions and model defaults", async () => {
		const here = device("here");
		const reviewer = await here.prompts.createPrompt({
			name: "Reviewer",
			tags: ["code"],
			text: "v1",
			ownerId: null,
		});
		await here.prompts.saveText(reviewer.id, "v2");
		await here.prompts.setModelDefault("openai/gpt-x", reviewer.id, null);
		await here.prompts.createPrompt({
			name: "Hidden",
			tags: [],
			text: "someone else's",
			ownerId: "other-account",
		});
		const before = await here.prompts.getPrompt(reviewer.id);

		const exported = await exportChats(
			here.chats,
			null,
			Date.now,
			here.prompts,
		);
		expect(exported.promptCount).toBe(1);
		expect(exported.json).not.toContain("someone else's");

		const wiped = device("wiped");
		const result = await importChats(
			wiped.chats,
			exported.json,
			null,
			wiped.prompts,
		);
		expect(result.promptsImported).toBe(1);
		expect(await wiped.prompts.listPrompts()).toEqual([before]);
		expect(before?.defaultFor).toEqual(["openai/gpt-x"]);

		// Importing the same file again changes nothing.
		expect(
			(await importChats(wiped.chats, exported.json, null, wiped.prompts))
				.promptsImported,
		).toBe(0);
	});

	it("replaces a prompt only with a newer copy, which keeps the owner here", async () => {
		const here = device("owner-here");
		const mine = await here.prompts.createPrompt({
			name: "Mine",
			tags: [],
			text: "a",
			ownerId: "user-a",
		});
		const newer = {
			...mine,
			ownerId: null,
			name: "Renamed",
			updatedAt: mine.updatedAt + 10,
		};
		const file = (prompts: unknown[]) =>
			JSON.stringify({
				format: CHAT_EXPORT_FORMAT,
				exportVersion: 1,
				chats: [],
				prompts: prompts.map((p) => ({ ...(p as object), formatVersion: 1 })),
			});

		await importChats(
			here.chats,
			file([{ ...mine, name: "Old", updatedAt: 1 }]),
			null,
			here.prompts,
		);
		expect((await here.prompts.getPrompt(mine.id))?.name).toBe("Mine");
		await importChats(here.chats, file([newer]), null, here.prompts);
		expect(await here.prompts.getPrompt(mine.id)).toMatchObject({
			name: "Renamed",
			ownerId: "user-a",
		});
	});

	it("rejects a file with a bad prompt and writes nothing", async () => {
		const here = device("bad");
		const json = JSON.stringify({
			format: CHAT_EXPORT_FORMAT,
			exportVersion: 1,
			chats: [],
			prompts: [{ id: "p", formatVersion: 1, name: "No versions" }],
		});
		await expect(
			importChats(here.chats, json, null, here.prompts),
		).rejects.toBeInstanceOf(ChatStoreError);
		expect(await here.prompts.listPrompts()).toEqual([]);
	});

	it("imports files without prompts, and leaves prompts out when not asked", async () => {
		const here = device("old-file");
		const json = JSON.stringify({
			format: CHAT_EXPORT_FORMAT,
			exportVersion: 1,
			chats: [],
		});
		expect(
			(await importChats(here.chats, json, null, here.prompts)).promptsImported,
		).toBe(0);
		await here.prompts.createPrompt({
			name: "A",
			tags: [],
			text: "a",
			ownerId: null,
		});
		const { json: chatsOnly } = await exportChats(here.chats, null);
		expect(JSON.parse(chatsOnly)).not.toHaveProperty("prompts");
	});
});
