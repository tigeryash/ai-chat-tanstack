import {
	PROMPT_FORMAT_VERSION,
	type Prompt,
	readPrompt,
} from "@/lib/prompts/prompt";
import type { PromptStore } from "@/lib/prompts/prompt-store";
import type {
	SavedLayout,
	SavedLayoutStore,
} from "@/lib/workspaces/saved-layouts";
import {
	exportableLayouts,
	exportableWorkspaces,
	layoutsToImport,
	putLayouts,
	type StoredWorkspace,
	workspacesToImport,
} from "@/lib/workspaces/workspace-transfer";
import { z } from "@/lib/zod";
import type { Chat, ChatStore } from "./chat-store";
import { ChatStoreError, issuesOf } from "./errors";
import { CHAT_FORMAT_VERSION, type StoredChat, upgradeChat } from "./format";
import { type Newer, NOTHING_NEWER, newerThanHere } from "./newer-copy";
import { isVisibleTo, type Viewer } from "./ownership";

// Export files are versioned JSON (roadmap decision 10). `exportVersion` is the file's own layout;
// each chat carries its `formatVersion` and goes through the same migrations as a stored chat on import.
// Chats are copied field by field from the chat store, which holds no keys, so a field added to chats
// later can't slip into an export unnoticed.
//
// Owners travel with the chats (roadmap 1.9). An export holds only the chats the person can see, and
// an import never hands a chat to the signed-in account: a new chat keeps the owner in the file, and a
// chat already on this device keeps its owner here.
//
// Saved prompts (roadmap 3.6b) travel the same way, with their versions and the models they're the
// default for. `prompts` is optional, so files from before it still import, and an older app reading a
// newer file just skips them (same `exportVersion`).
//
// Version 2 (Refine R4) adds the viewer's workspaces and this browser's saved layouts
// (`src/lib/workspaces/workspace-transfer.ts`). Both are optional, so version 1 files still import.

export const CHAT_EXPORT_FORMAT = "highelo-chats";
export const CHAT_EXPORT_VERSION = 2;

export interface ChatExport {
	format: typeof CHAT_EXPORT_FORMAT;
	exportVersion: number;
	exportedAt: string;
	chats: StoredChat[];
	prompts?: StoredPrompt[];
	workspaces?: StoredWorkspace[];
	layouts?: SavedLayout[];
}

type StoredPrompt = Prompt & { formatVersion: number };

interface ExportCounts {
	chatCount: number;
	promptCount: number;
	workspaceCount: number;
	layoutCount: number;
	/** Chats that failed to load (corrupt, or from a newer app) and were left out. */
	unreadableChatIds: string[];
}

export interface ExportResult extends ExportCounts {
	json: string;
}

export interface ExportBlobResult extends ExportCounts {
	blob: Blob;
}

export interface ImportResult {
	/** Chats written: new ones, and ones newer than the copy on this device. */
	imported: number;
	/** Of `imported`, the chats that replaced an older copy on this device. */
	updated: number;
	/** Chats skipped because this device already has the same or a newer copy. */
	skipped: number;
	/** Chats written that belong to another account, so they stay hidden until it signs in here. */
	otherAccounts: number;
	/** Saved prompts written, by the same rules as chats (newer than the copy here, or new). */
	promptsImported: number;
	/** Of `promptsImported`, the prompts that replaced an older copy on this device. */
	promptsUpdated: number;
	/** Saved prompts skipped because this device already has the same or a newer copy. */
	promptsSkipped: number;
	/** Workspaces written, by the same rules as chats; panes without a chat are dropped. */
	workspacesImported: number;
	workspacesUpdated: number;
	/** Workspaces skipped: the copy here is the same or newer, or none of their panes has a chat. */
	workspacesSkipped: number;
	/** Saved layouts written (new, or newer than the copy here). */
	layoutsImported: number;
	layoutsUpdated: number;
	layoutsSkipped: number;
}

function toStoredChat(chat: Chat): StoredChat {
	return {
		formatVersion: CHAT_FORMAT_VERSION,
		id: chat.id,
		title: chat.title,
		createdAt: chat.createdAt,
		updatedAt: chat.updatedAt,
		...(chat.pinned && { pinned: true }),
		ownerId: chat.ownerId,
		...(chat.settings && { settings: chat.settings }),
		...(chat.votes && { votes: chat.votes }),
		messages: chat.messages,
		...(chat.branches && { branches: chat.branches }),
	};
}

function toStoredPrompt(prompt: Prompt): StoredPrompt {
	return {
		formatVersion: PROMPT_FORMAT_VERSION,
		id: prompt.id,
		ownerId: prompt.ownerId,
		name: prompt.name,
		tags: prompt.tags,
		versions: prompt.versions,
		...(prompt.defaultFor && { defaultFor: prompt.defaultFor }),
		createdAt: prompt.createdAt,
		updatedAt: prompt.updatedAt,
	};
}

/**
 * The export file in pieces: each chat is serialized on its own, after its own (asynchronous) read, so
 * a big library never sits in one `JSON.stringify` call that freezes the tab.
 */
async function exportParts(
	store: ChatStore,
	viewer: Viewer,
	now: () => number,
	prompts: PromptStore | undefined,
	layouts: SavedLayoutStore | undefined,
): Promise<ExportCounts & { parts: string[] }> {
	const header = {
		format: CHAT_EXPORT_FORMAT,
		exportVersion: CHAT_EXPORT_VERSION,
		exportedAt: new Date(now()).toISOString(),
	} satisfies Omit<ChatExport, "chats" | "prompts" | "workspaces" | "layouts">;
	const parts = [`${JSON.stringify(header).slice(0, -1)},"chats":[`];
	const chatIds = new Set<string>();
	const unreadableChatIds: string[] = [];
	const visible = (await store.listChats()).filter((chat) =>
		isVisibleTo(chat, viewer),
	);
	for (const summary of visible) {
		try {
			const chat = await store.getChat(summary.id);
			if (!chat) continue;
			if (chatIds.size > 0) parts.push(",");
			parts.push(JSON.stringify(toStoredChat(chat)));
			chatIds.add(chat.id);
		} catch (error) {
			if (!(error instanceof ChatStoreError)) throw error;
			unreadableChatIds.push(summary.id);
		}
	}
	parts.push("]");
	const savedPrompts = prompts
		? (await prompts.listPrompts())
				.filter((prompt) => isVisibleTo(prompt, viewer))
				.map(toStoredPrompt)
		: undefined;
	if (savedPrompts) parts.push(`,"prompts":${JSON.stringify(savedPrompts)}`);
	const workspaces = await exportableWorkspaces(store, viewer, chatIds);
	parts.push(`,"workspaces":${JSON.stringify(workspaces)}`);
	const savedLayouts = layouts ? exportableLayouts(layouts) : undefined;
	if (savedLayouts) parts.push(`,"layouts":${JSON.stringify(savedLayouts)}`);
	parts.push("}");
	return {
		parts,
		chatCount: chatIds.size,
		promptCount: savedPrompts?.length ?? 0,
		workspaceCount: workspaces.length,
		layoutCount: savedLayouts?.length ?? 0,
		unreadableChatIds,
	};
}

/**
 * Exports the chats `viewer` can see (their account's and the ones made signed out) and their
 * workspaces, plus their saved prompts when `prompts` is given and the saved layouts when `layouts` is.
 */
export async function exportChats(
	store: ChatStore,
	viewer: Viewer,
	now: () => number = Date.now,
	prompts?: PromptStore,
	layouts?: SavedLayoutStore,
): Promise<ExportResult> {
	const { parts, ...counts } = await exportParts(
		store,
		viewer,
		now,
		prompts,
		layouts,
	);
	return { json: parts.join(""), ...counts };
}

/** `exportChats` as a file, built from the pieces without joining them into one string first. */
export async function exportChatsBlob(
	store: ChatStore,
	viewer: Viewer,
	prompts: PromptStore,
	layouts: SavedLayoutStore,
	now: () => number = Date.now,
): Promise<ExportBlobResult> {
	const { parts, ...counts } = await exportParts(
		store,
		viewer,
		now,
		prompts,
		layouts,
	);
	return { blob: new Blob(parts, { type: "application/json" }), ...counts };
}

const exportFile = z.object({
	format: z.literal(CHAT_EXPORT_FORMAT),
	exportVersion: z.number().int().positive(),
	chats: z.array(z.unknown()),
	prompts: z.array(z.unknown()).optional(),
	workspaces: z.array(z.unknown()).optional(),
	layouts: z.array(z.unknown()).optional(),
});

function parseExportFile(json: string): z.infer<typeof exportFile> {
	let data: unknown;
	try {
		data = JSON.parse(json);
	} catch {
		throw new ChatStoreError("invalid-export", "The file isn't valid JSON.");
	}
	const parsed = exportFile.safeParse(data);
	if (!parsed.success) {
		throw new ChatStoreError(
			"invalid-export",
			"The file isn't a chat export.",
			{
				issues: issuesOf(parsed.error),
			},
		);
	}
	if (parsed.data.exportVersion > CHAT_EXPORT_VERSION) {
		throw new ChatStoreError(
			"too-new",
			"The file was exported by a newer version of the app.",
		);
	}
	return parsed.data;
}

/** The file's prompts, checked (a bad one fails the import), newer than here. */
async function promptsToImport(
	raw: readonly unknown[] | undefined,
	prompts: PromptStore,
): Promise<Newer<Prompt>> {
	if (!raw || raw.length === 0) return NOTHING_NEWER;
	const incoming = raw.map((entry) => {
		try {
			return readPrompt(entry);
		} catch (error) {
			if (!(error instanceof ChatStoreError)) throw error;
			throw new ChatStoreError(
				error.code === "too-new" ? "too-new" : "invalid-export",
				"A saved prompt in the file is invalid.",
			);
		}
	});
	return newerThanHere(incoming, await prompts.listPrompts());
}

/**
 * Restores chats and workspaces (and saved prompts and layouts, when `prompts` and `layouts` are given)
 * from an export. All or nothing: if anything in the file is invalid, nothing is written. One this
 * device already has is replaced only by a newer copy, and keeps its owner.
 */
export async function importChats(
	store: ChatStore,
	json: string,
	viewer: Viewer,
	prompts?: PromptStore,
	layouts?: SavedLayoutStore,
): Promise<ImportResult> {
	const file = parseExportFile(json);
	const newerPrompts = prompts
		? await promptsToImport(file.prompts, prompts)
		: NOTHING_NEWER;
	const newerLayouts = layouts
		? layoutsToImport(file.layouts, layouts)
		: NOTHING_NEWER;

	const incoming: Chat[] = [];
	for (const raw of file.chats) incoming.push(await upgradeChat(raw));
	const newerWorkspaces = await workspacesToImport(
		file.workspaces,
		store,
		viewer,
		new Set(incoming.map((chat) => chat.id)),
	);
	const newer = newerThanHere(incoming, await store.listChats());
	await store.putChats(newer.items);
	if (prompts && newerPrompts.items.length > 0) {
		await prompts.putPrompts(newerPrompts.items);
	}
	if (newerWorkspaces.items.length > 0) {
		await store.putWorkspaces(newerWorkspaces.items);
	}
	if (layouts) putLayouts(layouts, newerLayouts.items);
	return {
		imported: newer.items.length,
		updated: newer.updated,
		skipped: newer.skipped,
		otherAccounts: newer.items.filter((chat) => !isVisibleTo(chat, viewer))
			.length,
		promptsImported: newerPrompts.items.length,
		promptsUpdated: newerPrompts.updated,
		promptsSkipped: newerPrompts.skipped,
		workspacesImported: newerWorkspaces.items.length,
		workspacesUpdated: newerWorkspaces.updated,
		workspacesSkipped: newerWorkspaces.skipped,
		layoutsImported: newerLayouts.items.length,
		layoutsUpdated: newerLayouts.updated,
		layoutsSkipped: newerLayouts.skipped,
	};
}
