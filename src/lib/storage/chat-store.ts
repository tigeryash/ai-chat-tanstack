import type { UIMessage } from "ai";
import type { ChatSettings } from "@/lib/params/settings";
import type { Workspace, WorkspaceSummary } from "./workspace";

// What the app sees of a stored chat. `formatVersion` is a storage detail: chats come out of the store
// already migrated to the current format (see format.ts).
export interface Chat {
	id: string;
	/** Empty until the chat is named (by the person, or auto-titled in roadmap 1.4). */
	title: string;
	/** Milliseconds since the epoch. */
	createdAt: number;
	updatedAt: number;
	/** Pinned chats sit at the top of the sidebar. Absent means not pinned. */
	pinned?: boolean;
	/**
	 * The Better Auth user ID of the account the chat belongs to, or null for a chat made signed out
	 * (roadmap 1.9). Only decides what the app shows: every chat is still readable in this browser.
	 */
	ownerId: string | null;
	/** The settings panel's values and system prompt (roadmap 2.4b). Absent: never set. */
	settings?: ChatSettings;
	messages: UIMessage[];
}

/** One sidebar row. Reading it never loads or migrates the chat's messages. */
export interface ChatSummary {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	messageCount: number;
	pinned: boolean;
	ownerId: string | null;
}

// Where chats live on this device (roadmap decision 8). The browser saves once when a reply finishes
// (decision 11), so `saveMessages` takes the whole message list each time.
export interface ChatStore {
	/** Newest activity first. */
	listChats(): Promise<ChatSummary[]>;
	/** Migrated and validated; `undefined` if there is no such chat. */
	getChat(id: string): Promise<Chat | undefined>;
	/**
	 * Replaces the chat's messages, creating the chat if it's new. A new chat belongs to `ownerId`; an
	 * existing one keeps its owner. Call `requestPersistentStorage()` when `created` is true (decision 9).
	 */
	saveMessages(
		chatId: string,
		messages: readonly UIMessage[],
		ownerId: string | null,
	): Promise<{ created: boolean }>;
	/** Doesn't change `updatedAt`, so a rename doesn't reorder the sidebar. */
	renameChat(chatId: string, title: string): Promise<void>;
	/** Like a rename, doesn't change `updatedAt`. */
	setPinned(chatId: string, pinned: boolean): Promise<void>;
	/** Replaces the chat's settings. Does nothing for a chat that isn't saved, nor to `updatedAt`. */
	setSettings(chatId: string, settings: ChatSettings): Promise<void>;
	/** The shared system prompt (decision 19), "" when none. */
	getDefaultSystemPrompt(): Promise<string>;
	setDefaultSystemPrompt(prompt: string): Promise<void>;
	/** Moves chats to another owner, skipping any that no longer exist. Doesn't change `updatedAt`. */
	setOwner(chatIds: readonly string[], ownerId: string | null): Promise<void>;
	/**
	 * Calls `onChange` with `listChats()` now and after every change, from any tab, until the returned
	 * function is called.
	 */
	watchChats(
		onChange: (chats: ChatSummary[]) => void,
		onError: (error: unknown) => void,
	): () => void;
	/** Deleting a chat that doesn't exist does nothing. */
	deleteChat(chatId: string): Promise<void>;
	/** Writes whole chats, keeping their timestamps (import today, sync in Phase 6). */
	putChats(chats: readonly Chat[]): Promise<void>;
	/** Checked on read; `undefined` if there is no such workspace (roadmap 3.1). */
	getWorkspace(id: string): Promise<Workspace | undefined>;
	/** Creates or replaces a workspace, setting `updatedAt` (and `createdAt` when new). */
	saveWorkspace(
		workspace: Omit<Workspace, "createdAt" | "updatedAt">,
	): Promise<Workspace>;
	/** Like `watchChats`, newest first. Unreadable workspaces are left out. */
	watchWorkspaces(
		onChange: (workspaces: WorkspaceSummary[]) => void,
		onError: (error: unknown) => void,
	): () => void;
	/** Deletes the record only; its chats stay. Deleting one that doesn't exist does nothing. */
	deleteWorkspace(id: string): Promise<void>;
}
