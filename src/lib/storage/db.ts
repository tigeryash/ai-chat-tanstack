import Dexie, { type DexieOptions, type EntityTable, type Table } from "dexie";

// Chats get their own IndexedDB database. API keys (roadmap 1.1) live elsewhere, so nothing that reads
// this database, export included, can reach them.
export const CHAT_DB_NAME = "highelo-chats";

/** A sidebar row; the messages live in `messages`. */
export interface ChatRow {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	messageCount: number;
	/** The chat's format (format.ts), not Dexie's schema version below. */
	formatVersion: number;
}

export interface MessageRow {
	chatId: string;
	position: number;
	/** A `UIMessage` in the chat's format. Typed loosely because old formats differ. */
	message: unknown;
}

export type ChatDatabase = Dexie & {
	chats: EntityTable<ChatRow, "id">;
	messages: Table<MessageRow, [string, number]>;
};

export function openChatDatabase(
	name: string = CHAT_DB_NAME,
	options?: DexieOptions,
): ChatDatabase {
	const db = new Dexie(name, options) as ChatDatabase;
	// Dexie's version is the table layout. Messages are keyed by [chatId, position], so one key range
	// reads or deletes a chat's messages in order.
	db.version(1).stores({
		chats: "id, updatedAt",
		messages: "[chatId+position]",
	});
	return db;
}

export function messagesOf(db: ChatDatabase, chatId: string) {
	return db.messages
		.where("[chatId+position]")
		.between([chatId, Dexie.minKey], [chatId, Dexie.maxKey]);
}
