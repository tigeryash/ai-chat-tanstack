import {
	PROMPT_FORMAT_VERSION,
	type Prompt,
	readPrompt,
} from "@/lib/prompts/prompt";
import type { PromptStore } from "@/lib/prompts/prompt-store";
import { z } from "@/lib/zod";
import type { Chat, ChatStore } from "./chat-store";
import { ChatStoreError, issuesOf } from "./errors";
import { CHAT_FORMAT_VERSION, type StoredChat, upgradeChat } from "./format";
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

export const CHAT_EXPORT_FORMAT = "highelo-chats";
export const CHAT_EXPORT_VERSION = 1;

export interface ChatExport {
	format: typeof CHAT_EXPORT_FORMAT;
	exportVersion: number;
	exportedAt: string;
	chats: StoredChat[];
	prompts?: StoredPrompt[];
}

type StoredPrompt = Prompt & { formatVersion: number };

export interface ExportResult {
	json: string;
	chatCount: number;
	promptCount: number;
	/** Chats that failed to load (corrupt, or from a newer app) and were left out. */
	unreadableChatIds: string[];
}

export interface ImportResult {
	/** Chats written: new ones, and ones newer than the copy on this device. */
	imported: number;
	/** Chats skipped because this device already has the same or a newer copy. */
	skipped: number;
	/** Chats written that belong to another account, so they stay hidden until it signs in here. */
	otherAccounts: number;
	/** Saved prompts written, by the same rules as chats (newer than the copy here, or new). */
	promptsImported: number;
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
 * Exports the chats `viewer` can see (their account's and the ones made signed out), and their saved
 * prompts when `prompts` is given.
 */
export async function exportChats(
	store: ChatStore,
	viewer: Viewer,
	now: () => number = Date.now,
	prompts?: PromptStore,
): Promise<ExportResult> {
	const chats: StoredChat[] = [];
	const unreadableChatIds: string[] = [];
	const visible = (await store.listChats()).filter((chat) =>
		isVisibleTo(chat, viewer),
	);
	for (const summary of visible) {
		try {
			const chat = await store.getChat(summary.id);
			if (chat) chats.push(toStoredChat(chat));
		} catch (error) {
			if (!(error instanceof ChatStoreError)) throw error;
			unreadableChatIds.push(summary.id);
		}
	}
	const savedPrompts = prompts
		? (await prompts.listPrompts())
				.filter((prompt) => isVisibleTo(prompt, viewer))
				.map(toStoredPrompt)
		: undefined;
	const file: ChatExport = {
		format: CHAT_EXPORT_FORMAT,
		exportVersion: CHAT_EXPORT_VERSION,
		exportedAt: new Date(now()).toISOString(),
		chats,
		...(savedPrompts && { prompts: savedPrompts }),
	};
	return {
		json: JSON.stringify(file),
		chatCount: chats.length,
		promptCount: savedPrompts?.length ?? 0,
		unreadableChatIds,
	};
}

const exportFile = z.object({
	format: z.literal(CHAT_EXPORT_FORMAT),
	exportVersion: z.number().int().positive(),
	chats: z.array(z.unknown()),
	prompts: z.array(z.unknown()).optional(),
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

interface Versioned {
	id: string;
	updatedAt: number;
	ownerId: string | null;
}

/** Within one file the newest copy wins; then only new ones, and ones newer than the copy here. */
function newerThanHere<T extends Versioned>(
	incoming: readonly T[],
	here: readonly Versioned[],
): T[] {
	const newest = new Map<string, T>();
	for (const item of incoming) {
		const seen = newest.get(item.id);
		if (!seen || item.updatedAt > seen.updatedAt) newest.set(item.id, item);
	}
	const local = new Map(here.map((item) => [item.id, item]));
	return [...newest.values()].flatMap((item) => {
		const mine = local.get(item.id);
		if (!mine) return [item];
		return item.updatedAt > mine.updatedAt
			? [{ ...item, ownerId: mine.ownerId }]
			: [];
	});
}

/** The file's prompts, checked (a bad one fails the import), newer than here. */
async function promptsToImport(
	raw: readonly unknown[] | undefined,
	prompts: PromptStore,
): Promise<Prompt[]> {
	if (!raw || raw.length === 0) return [];
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
 * Restores chats (and saved prompts, when `prompts` is given) from an export. All or nothing per
 * kind: if any chat or prompt in the file is invalid, nothing is written. One this device already has
 * is replaced only by a newer copy, and keeps its owner.
 */
export async function importChats(
	store: ChatStore,
	json: string,
	viewer: Viewer,
	prompts?: PromptStore,
): Promise<ImportResult> {
	const file = parseExportFile(json);
	const newerPrompts = prompts
		? await promptsToImport(file.prompts, prompts)
		: [];

	const incoming: Chat[] = [];
	for (const raw of file.chats) incoming.push(await upgradeChat(raw));
	const newer = newerThanHere(incoming, await store.listChats());
	const distinct = new Set(incoming.map((chat) => chat.id)).size;
	await store.putChats(newer);
	if (prompts && newerPrompts.length > 0) {
		await prompts.putPrompts(newerPrompts);
	}
	return {
		imported: newer.length,
		skipped: distinct - newer.length,
		otherAccounts: newer.filter((chat) => !isVisibleTo(chat, viewer)).length,
		promptsImported: newerPrompts.length,
	};
}
