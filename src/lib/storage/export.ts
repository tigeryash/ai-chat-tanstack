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

export const CHAT_EXPORT_FORMAT = "highelo-chats";
export const CHAT_EXPORT_VERSION = 1;

export interface ChatExport {
	format: typeof CHAT_EXPORT_FORMAT;
	exportVersion: number;
	exportedAt: string;
	chats: StoredChat[];
}

export interface ExportResult {
	json: string;
	chatCount: number;
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
		messages: chat.messages,
	};
}

/** Exports the chats `viewer` can see: their account's and the ones made signed out. */
export async function exportChats(
	store: ChatStore,
	viewer: Viewer,
	now: () => number = Date.now,
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
	const file: ChatExport = {
		format: CHAT_EXPORT_FORMAT,
		exportVersion: CHAT_EXPORT_VERSION,
		exportedAt: new Date(now()).toISOString(),
		chats,
	};
	return {
		json: JSON.stringify(file),
		chatCount: chats.length,
		unreadableChatIds,
	};
}

const exportFile = z.object({
	format: z.literal(CHAT_EXPORT_FORMAT),
	exportVersion: z.number().int().positive(),
	chats: z.array(z.unknown()),
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

/**
 * Restores chats from an export. All or nothing: if any chat in the file is invalid, nothing is
 * written. A chat this device already has is replaced only by a newer copy, and keeps its owner.
 */
export async function importChats(
	store: ChatStore,
	json: string,
	viewer: Viewer,
): Promise<ImportResult> {
	const file = parseExportFile(json);

	// Within one file, the newest copy of a chat wins.
	const incoming = new Map<string, Chat>();
	for (const raw of file.chats) {
		const chat = await upgradeChat(raw);
		const seen = incoming.get(chat.id);
		if (!seen || chat.updatedAt > seen.updatedAt) incoming.set(chat.id, chat);
	}

	const local = new Map(
		(await store.listChats()).map((chat) => [chat.id, chat]),
	);
	const newer = [...incoming.values()].flatMap((chat) => {
		const here = local.get(chat.id);
		if (!here) return [chat];
		return chat.updatedAt > here.updatedAt
			? [{ ...chat, ownerId: here.ownerId }]
			: [];
	});
	await store.putChats(newer);
	return {
		imported: newer.length,
		skipped: incoming.size - newer.length,
		otherAccounts: newer.filter((chat) => !isVisibleTo(chat, viewer)).length,
	};
}
