import type { UIMessage } from "ai";
import { liveQuery } from "dexie";
import type { Chat, ChatStore, ChatSummary } from "./chat-store";
import {
	type ChatDatabase,
	type ChatRow,
	messagesOf,
	openChatDatabase,
} from "./db";
import { ChatStoreError } from "./errors";
import {
	CHAT_FORMAT_VERSION,
	chatIdSchema,
	normalizeTitle,
	upgradeChat,
	validateMessages,
} from "./format";

export interface DexieChatStoreOptions {
	db?: ChatDatabase;
	now?: () => number;
}

function checkChatId(chatId: string): void {
	if (!chatIdSchema.safeParse(chatId).success) {
		throw new ChatStoreError("invalid-chat", "A chat ID is empty or too long.");
	}
}

function toSummary(row: ChatRow): ChatSummary {
	return {
		id: row.id,
		title: row.title,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		messageCount: row.messageCount,
		pinned: row.pinned ?? false,
	};
}

async function writeChat(
	db: ChatDatabase,
	row: ChatRow,
	messages: readonly UIMessage[],
): Promise<void> {
	await messagesOf(db, row.id).delete();
	await db.messages.bulkPut(
		messages.map((message, position) => ({
			chatId: row.id,
			position,
			message,
		})),
	);
	await db.chats.put(row);
}

async function updateRow(
	db: ChatDatabase,
	chatId: string,
	changes: Partial<Pick<ChatRow, "title" | "pinned">>,
): Promise<void> {
	const updated = await db.chats.update(chatId, changes);
	if (updated === 0) {
		throw new ChatStoreError("not-found", "That chat no longer exists.", {
			chatId,
		});
	}
}

// Validation is async (AI SDK), and a Dexie transaction commits as soon as it awaits anything that
// isn't Dexie, so every method validates first and then writes in one transaction.
export function createDexieChatStore({
	db = openChatDatabase(),
	now = Date.now,
}: DexieChatStoreOptions = {}): ChatStore {
	const listChats = async () => {
		const rows = await db.chats.orderBy("updatedAt").reverse().toArray();
		return rows.map(toSummary);
	};

	return {
		listChats,

		watchChats(onChange, onError) {
			// liveQuery re-runs the read whenever the chats table changes, in this tab or another.
			const subscription = liveQuery(listChats).subscribe({
				next: onChange,
				error: onError,
			});
			return () => subscription.unsubscribe();
		},

		async getChat(id) {
			const raw = await db.transaction("r", db.chats, db.messages, async () => {
				const row = await db.chats.get(id);
				if (!row) return undefined;
				const rows = await messagesOf(db, id).toArray();
				return { ...row, messages: rows.map((entry) => entry.message) };
			});
			return raw && upgradeChat(raw);
		},

		async saveMessages(chatId, messages) {
			checkChatId(chatId);
			const valid = await validateMessages(messages, chatId);
			return db.transaction("rw", db.chats, db.messages, async () => {
				const existing = await db.chats.get(chatId);
				// Overwriting would throw away whatever the newer format added.
				if (existing && existing.formatVersion > CHAT_FORMAT_VERSION) {
					throw new ChatStoreError(
						"too-new",
						"This chat was saved by a newer version of the app.",
						{ chatId },
					);
				}
				const timestamp = now();
				await writeChat(
					db,
					{
						id: chatId,
						title: existing?.title ?? "",
						...(existing?.pinned && { pinned: true }),
						createdAt: existing?.createdAt ?? timestamp,
						updatedAt: timestamp,
						messageCount: valid.length,
						formatVersion: CHAT_FORMAT_VERSION,
					},
					valid,
				);
				return { created: !existing };
			});
		},

		async renameChat(chatId, title) {
			await updateRow(db, chatId, { title: normalizeTitle(title) });
		},

		async setPinned(chatId, pinned) {
			await updateRow(db, chatId, { pinned });
		},

		async deleteChat(chatId) {
			await db.transaction("rw", db.chats, db.messages, async () => {
				await messagesOf(db, chatId).delete();
				await db.chats.delete(chatId);
			});
		},

		async putChats(chats: readonly Chat[]) {
			// Run through the same checks as a loaded chat, so the store only ever holds valid chats.
			const valid = await Promise.all(
				chats.map((chat) =>
					upgradeChat({ ...chat, formatVersion: CHAT_FORMAT_VERSION }),
				),
			);
			await db.transaction("rw", db.chats, db.messages, async () => {
				for (const chat of valid) {
					await writeChat(
						db,
						{
							id: chat.id,
							title: chat.title,
							createdAt: chat.createdAt,
							updatedAt: chat.updatedAt,
							messageCount: chat.messages.length,
							...(chat.pinned && { pinned: true }),
							formatVersion: CHAT_FORMAT_VERSION,
						},
						chat.messages,
					);
				}
			});
		},
	};
}
