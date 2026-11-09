import type { UIMessage } from "ai";
import { cleanSettings } from "@/lib/params/settings";
import { z } from "@/lib/zod";
import {
	branchesSchema,
	type ChatBranches,
	hasBranches,
	normalizeBranches,
} from "./branches";
import type { Chat } from "./chat-store";
import { ChatStoreError, issuesOf } from "./errors";
import { v0ToV1 } from "./migrations/v0-to-v1";
import { v1ToV2 } from "./migrations/v1-to-v2";
import { v2ToV3 } from "./migrations/v2-to-v3";

// Stored chats are versioned (roadmap decision 10). `MIGRATIONS[n]` is a pure function that turns a
// format-n chat into a format-(n+1) chat, so the current format is the length of the list. Loading a
// chat, from IndexedDB or an import file, runs every migration from its version up, then validates it.
//
// When an AI SDK upgrade changes the message shape: append one migration, add a fixture of the old
// format to format.test.ts, and never edit a migration that has shipped.
//
// The store's `chats` rows (id, title, createdAt, updatedAt, messageCount, pinned, ownerId) are read without
// migrating, for the sidebar. A migration that changes one of those also needs a Dexie `version().upgrade()`
// in db.ts (v1ToV2 has one).
const MIGRATIONS: readonly ((chat: unknown) => unknown)[] = [
	v0ToV1,
	v1ToV2,
	v2ToV3,
];

export const CHAT_FORMAT_VERSION = MIGRATIONS.length;

export const MAX_TITLE_LENGTH = 200;

/** A chat as written to IndexedDB and to export files. */
export type StoredChat = Chat & { formatVersion: number };

export function normalizeTitle(title: string): string {
	return title.trim().slice(0, MAX_TITLE_LENGTH);
}

export const chatIdSchema = z.string().min(1).max(256);

/** A Better Auth user ID, or null for a chat made signed out (roadmap 1.9). */
export const ownerIdSchema = z.string().min(1).max(256).nullable();

const timestamp = z.number().int().nonnegative();

const currentChat = z.object({
	formatVersion: z.literal(CHAT_FORMAT_VERSION),
	id: chatIdSchema,
	title: z.string().transform(normalizeTitle),
	createdAt: timestamp,
	updatedAt: timestamp,
	// Optional, so chats saved before pinning existed still read without a migration.
	pinned: z.boolean().optional(),
	ownerId: ownerIdSchema,
	// Optional, so older chats read without a migration. Bad values are dropped, not the chat.
	settings: z.unknown().optional(),
	messages: z.array(z.unknown()),
	// Format 3 (roadmap 1.7). Optional, so a chat written without any (a test, `putChats`) still reads.
	branches: branchesSchema.optional(),
});

function chatIdOf(raw: unknown): string | undefined {
	const id = (raw as { id?: unknown } | null)?.id;
	return typeof id === "string" ? id : undefined;
}

function formatVersionOf(raw: unknown, chatId: string | undefined): number {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		throw new ChatStoreError("invalid-chat", "A stored chat isn't an object.", {
			chatId,
		});
	}
	const version = (raw as { formatVersion?: unknown }).formatVersion ?? 0;
	if (!Number.isSafeInteger(version) || (version as number) < 0) {
		throw new ChatStoreError(
			"invalid-chat",
			"A chat has an unreadable format.",
			{
				chatId,
			},
		);
	}
	return version as number;
}

/**
 * Validates messages against AI SDK's `UIMessage` schema. Returns AI SDK's parsed copy. The AI SDK
 * loads on first use, so the sidebar can list chats without it (quality audit P1).
 */
export async function validateMessages(
	messages: readonly unknown[],
	chatId?: string,
): Promise<UIMessage[]> {
	// AI SDK rejects an empty list, but a chat may have no messages yet.
	if (messages.length === 0) return [];
	const { safeValidateUIMessages } = await import("ai");
	const result = await safeValidateUIMessages({ messages });
	if (!result.success) {
		throw new ChatStoreError("invalid-chat", "A chat has invalid messages.", {
			chatId,
			issues: issuesOf(result.error),
		});
	}
	return result.data;
}

/** Migrates a chat of any known format to the current one and validates it. */
export async function upgradeChat(raw: unknown): Promise<Chat> {
	const chatId = chatIdOf(raw);
	const version = formatVersionOf(raw, chatId);
	if (version > CHAT_FORMAT_VERSION) {
		throw new ChatStoreError(
			"too-new",
			"This chat was saved by a newer version of the app.",
			{ chatId },
		);
	}

	let chat = raw;
	try {
		for (const migrate of MIGRATIONS.slice(version)) chat = migrate(chat);
	} catch (error) {
		throw new ChatStoreError("invalid-chat", "A chat couldn't be upgraded.", {
			chatId,
			issues: issuesOf(error),
		});
	}

	const parsed = currentChat.safeParse(chat);
	if (!parsed.success) {
		throw new ChatStoreError("invalid-chat", "A chat is missing fields.", {
			chatId,
			issues: issuesOf(parsed.error),
		});
	}
	const { formatVersion: _, settings, branches, ...fields } = parsed.data;
	const messages = await validateMessages(fields.messages, fields.id);
	const valid =
		branches && (await validateBranches(branches, messages, fields.id));
	return {
		...fields,
		...(settings !== undefined && { settings: cleanSettings(settings) }),
		messages,
		...(hasBranches(valid) && { branches: valid }),
	};
}

/**
 * Checks off-path messages like the path's, then drops whatever the path no longer reaches. Absent
 * from a chat when it has no branches, so a chat that never forked reads as before.
 */
export async function validateBranches(
	branches: z.infer<typeof branchesSchema>,
	path: readonly UIMessage[],
	chatId?: string,
): Promise<ChatBranches> {
	const messages = await validateMessages(
		branches.messages.map((entry) => entry.message),
		chatId,
	);
	return normalizeBranches(path, {
		forks: branches.forks,
		messages: branches.messages.map((entry, i) => ({
			parentId: entry.parentId,
			message: messages[i] as UIMessage,
		})),
	});
}
