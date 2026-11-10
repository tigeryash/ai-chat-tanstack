// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createDexiePromptStore } from "@/lib/prompts/prompt-store";
import { memoryLayoutStore } from "@/lib/workspaces/layout-store.fixtures";
import {
	exportFileName,
	exportSummary,
	importErrorMessage,
	importSummary,
	MAX_IMPORT_MB,
	readImportFile,
} from "./data-file";
import { createDexieChatStore } from "./dexie-chat-store";
import { ChatStoreError } from "./errors";
import {
	CHAT_EXPORT_FORMAT,
	CHAT_EXPORT_VERSION,
	exportChats,
	exportChatsBlob,
	importChats,
} from "./export";
import { openTestDatabase, textMessage, tickingClock } from "./test-support";

// Settings → Your data (roadmap 1.10): the file checks and wording around export/import.

function device(name: string) {
	const db = openTestDatabase(name);
	return {
		chats: createDexieChatStore({ db, now: tickingClock() }),
		prompts: createDexiePromptStore({ db, now: tickingClock() }),
		layouts: memoryLayoutStore(),
	};
}

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
	try {
		await promise;
	} catch (error) {
		return error;
	}
	throw new Error("expected the import to fail");
}

describe("readImportFile", () => {
	it("refuses a file over the cap without reading it", async () => {
		let read = false;
		const error = await failureOf(
			readImportFile({
				size: MAX_IMPORT_MB * 1024 * 1024 + 1,
				text: async () => {
					read = true;
					return "{}";
				},
			}),
		);
		expect(error).toBeInstanceOf(ChatStoreError);
		expect((error as ChatStoreError).code).toBe("too-large");
		expect(read).toBe(false);
		expect(importErrorMessage(error)).toContain(`${MAX_IMPORT_MB} MB`);
	});

	it("reads a file under the cap", async () => {
		expect(await readImportFile({ size: 2, text: async () => "{}" })).toBe(
			"{}",
		);
	});
});

describe("importing a bad file", () => {
	const cases: [string, string, string][] = [
		["not JSON", "{ nope", "isn't a High Elo LLMs export"],
		[
			"another app's JSON",
			JSON.stringify({ format: "other", chats: [] }),
			"isn't a High Elo LLMs export",
		],
		[
			"a damaged chat",
			JSON.stringify({
				format: CHAT_EXPORT_FORMAT,
				exportVersion: CHAT_EXPORT_VERSION,
				chats: [{ id: 1 }],
			}),
			"isn't a High Elo LLMs export",
		],
		[
			"a newer export version",
			JSON.stringify({
				format: CHAT_EXPORT_FORMAT,
				exportVersion: CHAT_EXPORT_VERSION + 1,
				chats: [],
			}),
			"newer version of the app",
		],
	];

	it.each(cases)(
		"%s: friendly error, nothing written",
		async (_, json, text) => {
			const here = device(`bad-${text.length}-${json.length}`);
			await here.chats.saveMessages(
				"kept",
				[textMessage("m1", "user", "hi")],
				null,
			);
			const error = await failureOf(
				importChats(here.chats, json, null, here.prompts),
			);
			expect(importErrorMessage(error)).toContain(text);
			expect((await here.chats.listChats()).map((chat) => chat.id)).toEqual([
				"kept",
			]);
			expect(await here.prompts.listPrompts()).toEqual([]);
		},
	);

	it("never repeats an unknown error's text", () => {
		expect(importErrorMessage(new Error("secret prompt text"))).not.toContain(
			"secret",
		);
	});
});

describe("export file", () => {
	it("names the file by the local date", () => {
		expect(exportFileName(new Date(2026, 0, 5, 23, 59))).toBe(
			"high-elo-llms-export-2026-01-05.json",
		);
	});

	it("the blob holds the same file as the JSON export, and imports back", async () => {
		const here = device("blob");
		await here.chats.saveMessages(
			"c1",
			[textMessage("m1", "user", "one")],
			null,
		);
		await here.chats.saveMessages(
			"c2",
			[textMessage("m1", "user", "two")],
			null,
		);
		await here.prompts.createPrompt({
			name: "P",
			tags: [],
			text: "be brief",
			ownerId: null,
		});
		const now = () => 0;
		const json = await exportChats(
			here.chats,
			null,
			now,
			here.prompts,
			here.layouts,
		);
		const blob = await exportChatsBlob(
			here.chats,
			null,
			here.prompts,
			here.layouts,
			now,
		);
		expect(await blob.blob.text()).toBe(json.json);
		expect(JSON.parse(json.json)).toMatchObject({
			exportedAt: expect.any(String),
		});
		expect(exportSummary(blob)).toBe("Exported 2 chats and 1 saved prompt.");

		const there = device("blob-there");
		const result = await importChats(
			there.chats,
			await blob.blob.text(),
			null,
			there.prompts,
			there.layouts,
		);
		expect(importSummary(result)).toBe(
			"Chats: 2 added, 0 updated, 0 already up to date. Saved prompts: 1 added, 0 updated, 0 already up to date. Workspaces: 0 added, 0 updated, 0 already up to date. Saved layouts: 0 added, 0 updated, 0 already up to date.",
		);
		const again = await importChats(
			there.chats,
			await blob.blob.text(),
			null,
			there.prompts,
			there.layouts,
		);
		expect(importSummary(again)).toBe(
			"Chats: 0 added, 0 updated, 2 already up to date. Saved prompts: 0 added, 0 updated, 1 already up to date. Workspaces: 0 added, 0 updated, 0 already up to date. Saved layouts: 0 added, 0 updated, 0 already up to date.",
		);
	});

	it("exports an empty library as a valid file", async () => {
		const here = device("empty");
		const { blob } = await exportChatsBlob(
			here.chats,
			null,
			here.prompts,
			here.layouts,
		);
		expect(JSON.parse(await blob.text())).toMatchObject({
			chats: [],
			prompts: [],
			workspaces: [],
			layouts: [],
		});
	});
});
