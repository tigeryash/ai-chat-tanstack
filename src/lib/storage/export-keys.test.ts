// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { listProviderKeys, saveProviderKey } from "@/lib/keys";
import { createDexiePromptStore } from "@/lib/prompts/prompt-store";
import { memoryLayoutStore } from "@/lib/workspaces/layout-store.fixtures";
import { createDexieChatStore } from "./dexie-chat-store";
import { exportChatsBlob } from "./export";
import { openTestDatabase, textMessage, tickingClock } from "./test-support";

// Hard rule 1: keys never go in exports. Keys live in their own database (`src/lib/keys/`), and
// exports copy chats, prompts and workspaces field by field (saved layouts are checked against
// their schema, which has no key field); this pins both with real keys saved in the vault.

// Built at runtime so GitHub's secret scanning doesn't take them for real keys.
const REMEMBERED = ["sk-proj", "remembered", "KEY0123456789abcdef"].join("-");
const SESSION = ["sk-ant", "session", "KEY0123456789abcdef"].join("-");

describe("exports and keys", () => {
	it("an export with keys saved contains no key", async () => {
		await saveProviderKey("openai", REMEMBERED, "remember");
		await saveProviderKey("anthropic", SESSION, "session");
		expect(await listProviderKeys()).toHaveLength(2);

		const db = openTestDatabase("keys");
		const chats = createDexieChatStore({ db, now: tickingClock() });
		const prompts = createDexiePromptStore({ db, now: tickingClock() });
		await chats.saveMessages("c1", [textMessage("m1", "user", "hello")], null);
		await prompts.createPrompt({
			name: "P",
			tags: [],
			text: "be brief",
			ownerId: null,
		});

		await chats.saveWorkspace({
			id: "w1",
			ownerId: null,
			panes: [{ chatId: "c1", size: 100, synced: true }],
		});
		const layouts = memoryLayoutStore([
			{
				id: "l1",
				name: "Pair",
				panes: [{ model: null, size: 100, synced: true }],
				savedAt: 1,
			},
		]);

		const { blob, chatCount, promptCount, workspaceCount, layoutCount } =
			await exportChatsBlob(chats, null, prompts, layouts);
		const file = await blob.text();
		expect([chatCount, promptCount, workspaceCount, layoutCount]).toEqual([
			1, 1, 1, 1,
		]);
		for (const key of [REMEMBERED, SESSION]) {
			expect(file).not.toContain(key);
			expect(file).not.toContain(key.slice(-8));
		}
		expect(file).not.toMatch(/apiKey|"key"|secret/i);
	});
});
