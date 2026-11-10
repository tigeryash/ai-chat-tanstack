import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { lastReplyChoice } from "@/lib/chat/chat-model-choice";
import type { ModelChoice } from "@/lib/chat/model-selection";
import { memoryLayoutStore } from "@/lib/workspaces/layout-store.fixtures";
import {
	MAX_SAVED_LAYOUTS,
	type SavedLayout,
} from "@/lib/workspaces/saved-layouts";
import type { ChatStore } from "./chat-store";
import { createDexieChatStore } from "./dexie-chat-store";
import {
	CHAT_EXPORT_FORMAT,
	exportChats,
	type ImportResult,
	importChats,
} from "./export";
import { openTestDatabase, textMessage, tickingClock } from "./test-support";
import { WORKSPACE_FORMAT_VERSION, type Workspace } from "./workspace";

// Workspaces and saved layouts in exports (Refine R4, follow-up to roadmaps 1.10 and 3.5): they
// round-trip with their panes, widths and models, version 1 files still import, owners follow the
// chats' rules, and a pane never points at a chat that isn't there or the viewer can't see.

function device(name: string, layouts: SavedLayout[] = []) {
	return {
		chats: createDexieChatStore({
			db: openTestDatabase(name),
			now: tickingClock(),
		}),
		layouts: memoryLayoutStore(layouts),
	};
}

const OPUS: ModelChoice = {
	provider: "openrouter",
	model: "anthropic/claude-opus-5.5",
	gatewayId: "anthropic/claude-opus-5.5",
};
const GPT: ModelChoice = {
	provider: "openai",
	model: "gpt-5.5",
	gatewayId: "openai/gpt-5.5",
};
const LOCAL: ModelChoice = {
	provider: "local",
	model: "qwen3",
	endpoint: "ollama",
};

function reply(id: string, model: ModelChoice): UIMessage {
	return { ...textMessage(id, "assistant", "hi"), metadata: model };
}

async function saveChat(
	store: ChatStore,
	id: string,
	ownerId: string | null,
	model: ModelChoice = OPUS,
) {
	await store.saveMessages(
		id,
		[textMessage(`${id}-q`, "user", "hello"), reply(`${id}-a`, model)],
		ownerId,
	);
}

const layout = (id: string, savedAt: number, name = id): SavedLayout => ({
	id,
	name,
	panes: [
		{ model: OPUS, size: 60, synced: true },
		{ model: null, size: 40, synced: false },
	],
	savedAt,
});

function nothing(): Omit<ImportResult, never> {
	return {
		imported: 0,
		updated: 0,
		skipped: 0,
		otherAccounts: 0,
		promptsImported: 0,
		promptsUpdated: 0,
		promptsSkipped: 0,
		workspacesImported: 0,
		workspacesUpdated: 0,
		workspacesSkipped: 0,
		layoutsImported: 0,
		layoutsUpdated: 0,
		layoutsSkipped: 0,
	};
}

function file(parts: {
	exportVersion?: number;
	chats?: unknown[];
	workspaces?: unknown[];
	layouts?: unknown[];
}) {
	return JSON.stringify({
		format: CHAT_EXPORT_FORMAT,
		exportVersion: 2,
		chats: [],
		...parts,
	});
}

const storedWorkspace = (
	id: string,
	chatIds: string[],
	updatedAt = 10,
	ownerId: string | null = null,
) => ({
	formatVersion: WORKSPACE_FORMAT_VERSION,
	id,
	ownerId,
	panes: chatIds.map((chatId) => ({
		chatId,
		size: 100 / chatIds.length,
		synced: true,
	})),
	createdAt: 1,
	updatedAt,
});

describe("workspaces and layouts in exports", () => {
	it("export → wipe → import restores a 3-pane workspace with its models, and a layout", async () => {
		const here = device("round-trip", [layout("l1", 5, "Three way")]);
		await saveChat(here.chats, "a", null, OPUS);
		await saveChat(here.chats, "b", null, GPT);
		await saveChat(here.chats, "c", null, LOCAL);
		const saved = await here.chats.saveWorkspace({
			id: "w1",
			ownerId: null,
			panes: [
				{ chatId: "a", size: 50, synced: true },
				{ chatId: "b", size: 30, synced: true },
				{ chatId: "c", size: 20, synced: false },
			],
		});

		const exported = await exportChats(
			here.chats,
			null,
			Date.now,
			undefined,
			here.layouts,
		);
		expect(exported).toMatchObject({ workspaceCount: 1, layoutCount: 1 });

		const wiped = device("round-trip-wiped");
		expect(
			await importChats(
				wiped.chats,
				exported.json,
				null,
				undefined,
				wiped.layouts,
			),
		).toEqual({
			...nothing(),
			imported: 3,
			workspacesImported: 1,
			layoutsImported: 1,
		});
		expect(await wiped.chats.getWorkspace("w1")).toEqual(saved);
		expect(wiped.layouts.read()).toEqual(here.layouts.read());
		// Each pane's model comes back with its chat's replies.
		const models = await Promise.all(
			saved.panes.map(async (pane) =>
				lastReplyChoice(
					(await wiped.chats.getChat(pane.chatId))?.messages ?? [],
				),
			),
		);
		expect(models).toEqual([OPUS, GPT, LOCAL]);

		// Importing the same file again changes nothing.
		expect(
			await importChats(
				wiped.chats,
				exported.json,
				null,
				undefined,
				wiped.layouts,
			),
		).toEqual({
			...nothing(),
			skipped: 3,
			workspacesSkipped: 1,
			layoutsSkipped: 1,
		});
	});

	it("still imports a version 1 file, which has no workspaces or layouts", async () => {
		const there = device("v1", [layout("mine", 1)]);
		const v1 = file({
			exportVersion: 1,
			chats: [
				{
					formatVersion: 1,
					id: "c1",
					title: "",
					createdAt: 1,
					updatedAt: 1,
					messages: [textMessage("m1", "user", "old file")],
				},
			],
		});
		expect(
			await importChats(there.chats, v1, null, undefined, there.layouts),
		).toEqual({ ...nothing(), imported: 1 });
		expect(there.layouts.read()).toEqual([layout("mine", 1)]);
	});

	it("exports only the viewer's workspaces, without panes of chats it leaves out", async () => {
		const here = device("export-owners");
		await saveChat(here.chats, "mine", "user-a");
		await saveChat(here.chats, "theirs", "user-b");
		await here.chats.saveWorkspace({
			id: "shared",
			ownerId: "user-a",
			panes: [
				{ chatId: "mine", size: 25, synced: true },
				{ chatId: "theirs", size: 50, synced: true },
				{ chatId: "never-sent", size: 25, synced: true },
			],
		});
		await here.chats.saveWorkspace({
			id: "other-account",
			ownerId: "user-b",
			panes: [{ chatId: "theirs", size: 100, synced: true }],
		});

		const { json, workspaceCount } = await exportChats(here.chats, "user-a");
		expect(workspaceCount).toBe(1);
		expect(json).not.toContain("theirs");
		expect(json).not.toContain("never-sent");
		expect(JSON.parse(json).workspaces).toEqual([
			expect.objectContaining({
				id: "shared",
				ownerId: "user-a",
				panes: [{ chatId: "mine", size: 100, synced: true }],
			}),
		]);
	});

	it("drops panes whose chat is neither in the file nor here, and a workspace left with none", async () => {
		const there = device("missing-chat");
		await saveChat(there.chats, "here-already", null);
		const chat = {
			formatVersion: 1,
			id: "in-file",
			title: "",
			createdAt: 1,
			updatedAt: 1,
			messages: [textMessage("m1", "user", "hi")],
		};
		const result = await importChats(
			there.chats,
			file({
				chats: [chat],
				workspaces: [
					storedWorkspace("partly", ["in-file", "gone", "here-already"]),
					storedWorkspace("empty", ["gone", "also-gone"]),
				],
			}),
			null,
		);
		expect(result).toMatchObject({
			workspacesImported: 1,
			workspacesSkipped: 1,
		});
		expect(await there.chats.getWorkspace("empty")).toBeUndefined();
		const partly = await there.chats.getWorkspace("partly");
		expect(partly?.panes.map((pane) => pane.chatId)).toEqual([
			"in-file",
			"here-already",
		]);
		expect(partly?.panes.reduce((sum, pane) => sum + pane.size, 0)).toBe(100);
	});

	it("keeps the owner in the file, or the one here, never the signed-in account's", async () => {
		const there = device("owners");
		await saveChat(there.chats, "a", null);
		await there.chats.putWorkspaces([
			{ ...storedWorkspace("local", ["a"], 10, "user-a") },
		]);
		const result = await importChats(
			there.chats,
			file({
				workspaces: [
					storedWorkspace("theirs", ["a"], 10, "user-b"),
					storedWorkspace("local", ["a"], 20, "user-b"),
				],
			}),
			"user-a",
		);
		expect(result).toMatchObject({
			workspacesImported: 2,
			workspacesUpdated: 1,
		});
		expect(await there.chats.getWorkspace("theirs")).toMatchObject({
			ownerId: "user-b",
		});
		expect(await there.chats.getWorkspace("local")).toMatchObject({
			ownerId: "user-a",
			updatedAt: 20,
		});

		// An older copy is skipped.
		expect(
			await importChats(
				there.chats,
				file({ workspaces: [storedWorkspace("local", ["a"], 15)] }),
				"user-a",
			),
		).toMatchObject({ workspacesImported: 0, workspacesSkipped: 1 });
	});

	it("a newer copy keeps the panes here the viewer can't see", async () => {
		const there = device("hidden-panes");
		await saveChat(there.chats, "mine", "user-a");
		await saveChat(there.chats, "theirs", "user-b");
		const local: Workspace = {
			id: "w1",
			ownerId: "user-a",
			panes: [
				{ chatId: "mine", size: 50, synced: true },
				{ chatId: "theirs", size: 50, synced: true },
			],
			createdAt: 1,
			updatedAt: 10,
		};
		await there.chats.putWorkspaces([local]);

		await importChats(
			there.chats,
			file({ workspaces: [storedWorkspace("w1", ["mine"], 20)] }),
			"user-a",
		);
		expect((await there.chats.getWorkspace("w1"))?.panes).toEqual([
			{ chatId: "mine", size: 50, synced: true },
			{ chatId: "theirs", size: 50, synced: true },
		]);
	});

	it("writes nothing if a workspace or layout in the file is invalid", async () => {
		const there = device("invalid");
		const chat = {
			formatVersion: 1,
			id: "c1",
			title: "",
			createdAt: 1,
			updatedAt: 1,
			messages: [textMessage("m1", "user", "hi")],
		};
		await expect(
			importChats(
				there.chats,
				file({ chats: [chat], workspaces: [{ id: "w1", panes: [] }] }),
				null,
			),
		).rejects.toMatchObject({ code: "invalid-export" });
		await expect(
			importChats(
				there.chats,
				file({
					chats: [chat],
					workspaces: [{ ...storedWorkspace("w1", ["c1"]), formatVersion: 99 }],
				}),
				null,
			),
		).rejects.toMatchObject({ code: "too-new" });
		await expect(
			importChats(
				there.chats,
				file({ chats: [chat], layouts: [{ id: "l1", name: "" }] }),
				null,
				undefined,
				there.layouts,
			),
		).rejects.toMatchObject({ code: "invalid-export" });
		expect(await there.chats.listChats()).toEqual([]);
		expect(await there.chats.listWorkspaces()).toEqual([]);
		expect(there.layouts.read()).toEqual([]);
	});

	it("keeps the newer layout, and the newest ones up to the limit", async () => {
		const mine = Array.from({ length: MAX_SAVED_LAYOUTS }, (_, n) =>
			layout(`mine-${n}`, 100 + n),
		);
		const there = device("layouts", mine);
		const result = await importChats(
			there.chats,
			file({
				layouts: [
					layout("mine-0", 50, "older"),
					layout("mine-1", 500, "newer"),
					layout("new", 1000),
				],
			}),
			null,
			undefined,
			there.layouts,
		);
		expect(result).toMatchObject({
			layoutsImported: 2,
			layoutsUpdated: 1,
			layoutsSkipped: 1,
		});
		const after = there.layouts.read();
		expect(after).toHaveLength(MAX_SAVED_LAYOUTS);
		expect(after.at(-1)?.id).toBe("new");
		expect(after.find((l) => l.id === "mine-1")?.name).toBe("newer");
		// The oldest one made room.
		expect(after.some((l) => l.id === "mine-0")).toBe(false);
	});
});
