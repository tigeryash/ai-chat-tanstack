import type { UIMessage } from "ai";

// What the app sees of a stored chat. `formatVersion` is a storage detail: chats come out of the store
// already migrated to the current format (see format.ts).
export interface Chat {
	id: string;
	/** Empty until the chat is named (by the person, or auto-titled in roadmap 1.4). */
	title: string;
	/** Milliseconds since the epoch. */
	createdAt: number;
	updatedAt: number;
	messages: UIMessage[];
}

/** One sidebar row. Reading it never loads or migrates the chat's messages. */
export interface ChatSummary {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	messageCount: number;
}

// Where chats live on this device (roadmap decision 8). The browser saves once when a reply finishes
// (decision 11), so `saveMessages` takes the whole message list each time.
export interface ChatStore {
	/** Newest activity first. */
	listChats(): Promise<ChatSummary[]>;
	/** Migrated and validated; `undefined` if there is no such chat. */
	getChat(id: string): Promise<Chat | undefined>;
	/**
	 * Replaces the chat's messages, creating the chat if it's new. Call `requestPersistentStorage()`
	 * when `created` is true (decision 9).
	 */
	saveMessages(
		chatId: string,
		messages: readonly UIMessage[],
	): Promise<{ created: boolean }>;
	/** Doesn't change `updatedAt`, so a rename doesn't reorder the sidebar. */
	renameChat(chatId: string, title: string): Promise<void>;
	/** Deleting a chat that doesn't exist does nothing. */
	deleteChat(chatId: string): Promise<void>;
	/** Writes whole chats, keeping their timestamps (import today, sync in Phase 6). */
	putChats(chats: readonly Chat[]): Promise<void>;
}
