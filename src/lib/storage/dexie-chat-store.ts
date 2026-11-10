import type { UIMessage } from "ai";
import { liveQuery } from "dexie";
import {
	chatSettingsSchema,
	MAX_SYSTEM_PROMPT_LENGTH,
} from "@/lib/params/settings";
import { z } from "@/lib/zod";
import {
	type AttachmentRow,
	dehydrateAttachments,
	hydrateAttachments,
	referencedAttachments,
} from "./attachments";
import {
	branchesSchema,
	type ChatBranches,
	hasBranches,
	normalizeBranches,
} from "./branches";
import type { Chat, ChatStore, ChatSummary, NewChatFields } from "./chat-store";
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
	ownerIdSchema,
	upgradeChat,
	validateBranches,
	validateMessages,
} from "./format";
import { chatVotesSchema } from "./votes";
import {
	readWorkspace,
	toWorkspaceSummary,
	WORKSPACE_FORMAT_VERSION,
	type WorkspaceSummary,
	workspaceSchema,
} from "./workspace";

const DEFAULT_SYSTEM_PROMPT_KEY = "defaultSystemPrompt";
const systemPromptSchema = z.string().max(MAX_SYSTEM_PROMPT_LENGTH);

export interface DexieChatStoreOptions {
	db?: ChatDatabase;
	now?: () => number;
}

function checkChatId(chatId: string): void {
	if (!chatIdSchema.safeParse(chatId).success) {
		throw new ChatStoreError("invalid-chat", "A chat ID is empty or too long.");
	}
}

function checkOwnerId(ownerId: string | null): void {
	if (!ownerIdSchema.safeParse(ownerId).success) {
		throw new ChatStoreError(
			"invalid-chat",
			"An owner ID is empty or too long.",
		);
	}
}

/**
 * `whenCreated`, cleaned like a rename. Settings or votes that don't validate are left out rather than
 * failing the save: losing them beats losing the chat (reads drop bad ones the same way).
 */
function newChatFields(
	whenCreated: NewChatFields,
): Pick<ChatRow, "title" | "settings" | "votes"> {
	const { title = "", settings, votes } = whenCreated;
	const cleanSettings = settings && chatSettingsSchema.safeParse(settings);
	const cleanVotes = votes && chatVotesSchema.safeParse(votes);
	return {
		title: normalizeTitle(title),
		...(cleanSettings?.success && { settings: cleanSettings.data }),
		...(cleanVotes?.success && { votes: cleanVotes.data }),
	};
}

function toSummary(row: ChatRow): ChatSummary {
	return {
		id: row.id,
		title: row.title,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		messageCount: row.messageCount,
		pinned: row.pinned ?? false,
		ownerId: row.ownerId ?? null,
	};
}

/**
 * Writes the files the chat came with that aren't stored yet, and deletes the ones nothing points to
 * any more (roadmap 1.6). Files already stored are never rewritten.
 */
async function writeAttachments(
	db: ChatDatabase,
	chatId: string,
	rows: readonly AttachmentRow[],
	referenced: ReadonlySet<string>,
): Promise<void> {
	const stored = new Set(
		await db.attachments.where("chatId").equals(chatId).primaryKeys(),
	);
	await db.attachments.bulkDelete(
		[...stored].filter((id) => !referenced.has(id)),
	);
	await db.attachments.bulkPut(
		rows.filter((row) => referenced.has(row.id) && !stored.has(row.id)),
	);
}

/** Messages and branches go in with data-URL files swapped for references (attachments.ts). */
async function writeChat(
	db: ChatDatabase,
	row: ChatRow,
	plainMessages: readonly UIMessage[],
	plainBranches: ChatBranches | undefined,
): Promise<void> {
	const { messages, branches, rows } = dehydrateAttachments(
		row.id,
		plainMessages,
		plainBranches,
	);
	const kept = hasBranches(branches) ? branches : undefined;
	await writeAttachments(
		db,
		row.id,
		rows,
		referencedAttachments(messages, kept),
	);
	if (hasBranches(branches))
		await db.branches.put({ chatId: row.id, branches });
	else await db.branches.delete(row.id);
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

/** The stored branches, cut down to what `path` still reaches. A row that doesn't parse is dropped. */
async function storedBranches(
	db: ChatDatabase,
	chatId: string,
	path: readonly UIMessage[],
): Promise<ChatBranches | undefined> {
	const row = await db.branches.get(chatId);
	const parsed = branchesSchema.safeParse(row?.branches);
	if (!parsed.success) return undefined;
	// Checked against AI SDK's schema when they were written.
	return normalizeBranches(path, parsed.data as ChatBranches);
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

	const listWorkspaces = async (): Promise<WorkspaceSummary[]> => {
		const rows = await db.workspaces.orderBy("updatedAt").reverse().toArray();
		return rows.flatMap((row) => {
			try {
				return [toWorkspaceSummary(readWorkspace(row))];
			} catch {
				return [];
			}
		});
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
			const read = await db.transaction(
				"r",
				[db.chats, db.messages, db.branches, db.attachments],
				async () => {
					const row = await db.chats.get(id);
					if (!row) return undefined;
					const rows = await messagesOf(db, id).toArray();
					const branchRow = await db.branches.get(id);
					const files = await db.attachments
						.where("chatId")
						.equals(id)
						.toArray();
					return {
						raw: {
							...row,
							messages: rows.map((entry) => entry.message),
							...(branchRow && { branches: branchRow.branches }),
						},
						files,
					};
				},
			);
			if (!read) return undefined;
			return hydrateAttachments(await upgradeChat(read.raw), read.files);
		},

		async saveMessages(chatId, messages, ownerId, branches, whenCreated = {}) {
			checkChatId(chatId);
			checkOwnerId(ownerId);
			const initial = newChatFields(whenCreated);
			const valid = await validateMessages(messages, chatId);
			const validBranches =
				branches && (await validateBranches(branches, valid, chatId));
			const tables = [db.chats, db.messages, db.branches, db.attachments];
			return db.transaction("rw", tables, async () => {
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
						...(existing
							? {
									title: existing.title,
									...(existing.pinned && { pinned: true }),
									...(existing.settings && { settings: existing.settings }),
									...(existing.votes && { votes: existing.votes }),
								}
							: initial),
						ownerId: existing ? (existing.ownerId ?? null) : ownerId,
						createdAt: existing?.createdAt ?? timestamp,
						updatedAt: timestamp,
						messageCount: valid.length,
						formatVersion: CHAT_FORMAT_VERSION,
					},
					valid,
					validBranches ?? (await storedBranches(db, chatId, valid)),
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

		async setSettings(chatId, settings) {
			checkChatId(chatId);
			const clean = chatSettingsSchema.parse(settings);
			await db.chats.update(chatId, { settings: clean });
		},

		async setVotes(chatId, votes) {
			checkChatId(chatId);
			const clean = chatVotesSchema.parse(votes);
			await db.chats.update(chatId, { votes: clean });
		},

		async getDefaultSystemPrompt() {
			const row = await db.prefs.get(DEFAULT_SYSTEM_PROMPT_KEY);
			const parsed = systemPromptSchema.safeParse(row?.value);
			return parsed.success ? parsed.data : "";
		},

		async setDefaultSystemPrompt(prompt) {
			await db.prefs.put({
				key: DEFAULT_SYSTEM_PROMPT_KEY,
				value: systemPromptSchema.parse(prompt),
			});
		},

		async setOwner(chatIds, ownerId) {
			checkOwnerId(ownerId);
			await db.chats
				.where("id")
				.anyOf([...chatIds])
				.modify({ ownerId });
		},

		async deleteChat(chatId) {
			await db.transaction(
				"rw",
				[db.chats, db.messages, db.branches, db.attachments],
				async () => {
					await db.attachments.where("chatId").equals(chatId).delete();
					await db.branches.delete(chatId);
					await messagesOf(db, chatId).delete();
					await db.chats.delete(chatId);
				},
			);
		},

		async putChats(chats: readonly Chat[]) {
			// Run through the same checks as a loaded chat, so the store only ever holds valid chats.
			const valid = await Promise.all(
				chats.map((chat) =>
					upgradeChat({ ...chat, formatVersion: CHAT_FORMAT_VERSION }),
				),
			);
			await db.transaction(
				"rw",
				[db.chats, db.messages, db.branches, db.attachments],
				async () => {
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
								...(chat.settings && { settings: chat.settings }),
								...(chat.votes && { votes: chat.votes }),
								ownerId: chat.ownerId,
								formatVersion: CHAT_FORMAT_VERSION,
							},
							chat.messages,
							chat.branches,
						);
					}
				},
			);
		},

		async getWorkspace(id) {
			const row = await db.workspaces.get(id);
			return row && readWorkspace(row);
		},

		async saveWorkspace(workspace) {
			const timestamp = now();
			return db.transaction("rw", db.workspaces, async () => {
				const existing = await db.workspaces.get(workspace.id);
				if (existing && existing.formatVersion > WORKSPACE_FORMAT_VERSION) {
					throw new ChatStoreError(
						"too-new",
						"This workspace was saved by a newer version of the app.",
					);
				}
				const saved = workspaceSchema.parse({
					...workspace,
					createdAt: existing?.createdAt ?? timestamp,
					updatedAt: timestamp,
				});
				await db.workspaces.put({
					...saved,
					formatVersion: WORKSPACE_FORMAT_VERSION,
				});
				return saved;
			});
		},

		listWorkspaces,

		async setWorkspaceOwner(workspaceIds, ownerId) {
			checkOwnerId(ownerId);
			await db.workspaces
				.where("id")
				.anyOf([...workspaceIds])
				.modify({ ownerId });
		},

		watchWorkspaces(onChange, onError) {
			const subscription = liveQuery(listWorkspaces).subscribe({
				next: onChange,
				error: onError,
			});
			return () => subscription.unsubscribe();
		},

		async deleteWorkspace(id) {
			await db.workspaces.delete(id);
		},
	};
}
