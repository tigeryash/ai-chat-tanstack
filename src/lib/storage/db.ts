import Dexie, { type DexieOptions, type EntityTable, type Table } from "dexie";
import type { ChatSettings } from "@/lib/params/settings";
import type { Workspace } from "./workspace";

// Chats get their own IndexedDB database. API keys (roadmap 1.1) live elsewhere, so nothing that reads
// this database, export included, can reach them.
//
// Adding a version (slices run in parallel, and Dexie never runs an upgrade() for a version the browser
// has already passed, so one that lands out of order is silently skipped):
// 1. Prefer no version. New fields go on existing rows as optional values cleaned on read (like
//    `settings`). New data that needs a query goes in a new table, not a new index on `chats`.
// 2. Take the next number when you rebase on main, not when you start. Never reserve one; if main moved,
//    re-number your block to the end.
// 3. An upgrade() goes only in a version that changes nothing else, and only for data that must change in
//    place. Never edit a version block that has shipped.
// 4. Chat format migrations (format.ts `MIGRATIONS`) follow the same rule: append at rebase time.
//    Workspaces and other records get their own format number (workspace.ts), never the chat format's.
// 5. db.test.ts checks versions strictly increase, pins the latest schema (update it in the same commit),
//    and wants an upgrade test (opening a database at the previous version) for every upgrade().
// 6. Worktrees share localhost:3000's IndexedDB: a branch at a newer version leaves `highelo-chats`
//    there, and older code then fails with a VersionError. Delete it in DevTools (Application → IndexedDB).
export const CHAT_DB_NAME = "highelo-chats";

/** A sidebar row; the messages live in `messages`. */
export interface ChatRow {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	messageCount: number;
	/** Added after format 1 shipped, so older rows don't have it. Not indexed: sorting is in memory. */
	pinned?: boolean;
	/**
	 * Format 2 (roadmap 1.9). Rows are upgraded when the database opens, but a row written in an older
	 * format (a test seed) can lack it, which reads as null. Not indexed: IndexedDB can't index null.
	 */
	ownerId?: string | null;
	/**
	 * The settings panel's values and the chat's own system prompt (roadmap 2.4b). Absent: never set.
	 * Optional and cleaned on read, so it needed no format migration.
	 */
	settings?: ChatSettings;
	/** The chat's format (format.ts), not Dexie's schema version below. */
	formatVersion: number;
}

export interface MessageRow {
	chatId: string;
	position: number;
	/** A `UIMessage` in the chat's format. Typed loosely because old formats differ. */
	message: unknown;
}

/** App-wide values that hold content, so they stay out of localStorage (the shared system prompt). */
export interface PrefRow {
	key: string;
	value: unknown;
}

/** A workspace (roadmap 3.1) in its own format (workspace.ts), checked on read. */
export type WorkspaceRow = Workspace & { formatVersion: number };

export type ChatDatabase = Dexie & {
	chats: EntityTable<ChatRow, "id">;
	messages: Table<MessageRow, [string, number]>;
	prefs: EntityTable<PrefRow, "key">;
	workspaces: EntityTable<WorkspaceRow, "id">;
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
	// Format 2 adds `ownerId` to the rows the sidebar reads. Its migration (v1ToV2) leaves messages
	// alone, so format 1 rows can move to format 2 here without loading them.
	db.version(2)
		.stores({ chats: "id, updatedAt", messages: "[chatId+position]" })
		.upgrade((tx) =>
			tx
				.table<ChatRow, string>("chats")
				.toCollection()
				.modify((row, ref) => {
					if (row.formatVersion !== 1) return;
					ref.value = { ...row, formatVersion: 2, ownerId: null };
				}),
		);
	// Roadmap 2.4b: the shared system prompt.
	db.version(3).stores({
		chats: "id, updatedAt",
		messages: "[chatId+position]",
		prefs: "key",
	});
	// Roadmap 3.1: multi-pane workspaces.
	db.version(4).stores({
		chats: "id, updatedAt",
		messages: "[chatId+position]",
		prefs: "key",
		workspaces: "id, updatedAt",
	});
	return db;
}

export function messagesOf(db: ChatDatabase, chatId: string) {
	return db.messages
		.where("[chatId+position]")
		.between([chatId, Dexie.minKey], [chatId, Dexie.maxKey]);
}
