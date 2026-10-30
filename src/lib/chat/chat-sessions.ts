import { Chat } from "@ai-sdk/react";
import type { ChatTransport, UIMessage } from "ai";
import {
	reportReplyEnded,
	setReplying,
} from "@/lib/background-status/activity";
import { logError } from "@/lib/log";
import type { ChatStore } from "@/lib/storage/chat-store";
import { createDexieChatStore } from "@/lib/storage/dexie-chat-store";
import { isVisibleTo, type Viewer } from "@/lib/storage/ownership";
import { requestPersistentStorage } from "@/lib/storage/persistence";
import { BrowserChatTransport } from "./browser-transport";
import {
	chatSettingsOf,
	forgetChatSettings,
	loadChatSettings,
} from "./chat-settings";
import { titleFromMessages } from "./chat-title";
import { resolveAppModel } from "./e2e-model";

// Open chats in this tab, by chat id. A chat keeps streaming while the person moves between routes
// (`/new` hands its chat to `/$chatId` mid-reply), so the `Chat` objects live here, not in a component.
// Chats are saved to the local ChatStore once each reply finishes (roadmap decision 11).

let defaultStore: ChatStore | undefined;
/** The app's one chat store. Browser only: chat routes don't render on the server. */
export function chatStore(): ChatStore {
	defaultStore ??= createDexieChatStore();
	return defaultStore;
}

/** An open chat and who it belongs to (roadmap 1.9), so an unsaved chat has an owner too. */
interface OpenChat {
	chat: Chat<UIMessage>;
	ownerId: string | null;
}

const openChats = new Map<string, OpenChat>();
const defaultTransport = new BrowserChatTransport(resolveAppModel);

export interface OpenChatOptions {
	messages?: UIMessage[];
	transport?: ChatTransport<UIMessage>;
	store?: ChatStore;
	/** Who the chat belongs to: a Better Auth user ID, or null (the default) for no account. */
	ownerId?: string | null;
}

/**
 * Saves the whole chat. The first save names the chat after its first message (roadmap 1.4) and asks
 * the browser to keep our storage (decision 9). A chat that's already saved keeps its owner.
 */
export async function saveChat(
	store: ChatStore,
	chatId: string,
	messages: UIMessage[],
	ownerId: string | null,
): Promise<void> {
	if (messages.length === 0) return;
	try {
		const { created } = await store.saveMessages(chatId, messages, ownerId);
		if (!created) return;
		// Settings changed before the first reply had nowhere to go until now (roadmap 2.4b).
		const settings = chatSettingsOf(chatId);
		if (settings) await store.setSettings(chatId, settings);
		const title = titleFromMessages(messages);
		if (title) await store.renameChat(chatId, title);
		await requestPersistentStorage();
	} catch (error) {
		logError("Couldn't save the chat in this browser:", error);
	}
}

/** The open chat with this id, creating it (with `messages`) if this tab hasn't opened it yet. */
export function openChat(id: string, options: OpenChatOptions = {}) {
	const existing = openChats.get(id);
	if (existing) return existing.chat;
	const store = options.store ?? chatStore();
	const chat = new Chat<UIMessage>({
		id,
		messages: options.messages,
		transport: options.transport ?? defaultTransport,
		// Stopped and failed replies are saved too, so nothing the person typed is lost. A closed
		// (deleted) chat isn't, or stopping its reply would bring it back.
		onFinish: ({ messages, isAbort, isError }) => {
			const open = openChats.get(id);
			if (open?.chat !== chat) return;
			const saved = saveChat(store, id, messages, open.ownerId);
			// Reported once saved, so a notification can name the chat by its new title (roadmap 3.10).
			// Failures are reported by `onError`, which also covers requests that never got a response.
			if (!isAbort && !isError) {
				void saved.then(() =>
					reportReplyEnded({ chatId: id, outcome: "finished" }),
				);
			}
			return saved;
		},
		onError: () => {
			if (openChats.get(id)?.chat === chat) {
				reportReplyEnded({ chatId: id, outcome: "failed" });
			}
		},
	});
	// Tab status (roadmap 3.10) counts replies across every open chat. `~registerStatusCallback` is how
	// `useChat` itself watches a `Chat`; there's no other public way to observe it outside React.
	chat["~registerStatusCallback"](() =>
		setReplying(id, chat.status === "submitted" || chat.status === "streaming"),
	);
	openChats.set(id, { chat, ownerId: options.ownerId ?? null });
	return chat;
}

/** Stops the chat's reply, if any, and forgets it in this tab (after the chat is deleted). */
export function closeChat(id: string): void {
	const open = openChats.get(id);
	if (!open) return;
	openChats.delete(id);
	forgetChatSettings(id);
	setReplying(id, false);
	open.chat
		.stop()
		.catch((error) => logError("Couldn't stop the reply:", error));
}

export function isChatOpen(id: string): boolean {
	return openChats.has(id);
}

/** Whether this tab has the chat open and `viewer` may see it (roadmap 1.9). */
export function isOpenChatVisibleTo(id: string, viewer: Viewer): boolean {
	const open = openChats.get(id);
	return open !== undefined && isVisibleTo(open, viewer);
}

/**
 * Opens a saved chat. Resolves false when there's no such chat in this browser, or it belongs to an
 * account other than `viewer`'s: another account's chat looks missing.
 */
export async function openSavedChat(
	id: string,
	viewer: Viewer,
	store: ChatStore = chatStore(),
): Promise<boolean> {
	const open = openChats.get(id);
	if (open) return isVisibleTo(open, viewer);
	const saved = await store.getChat(id);
	if (!saved || !isVisibleTo(saved, viewer)) return false;
	loadChatSettings(id, saved.settings);
	openChat(id, { messages: saved.messages, store, ownerId: saved.ownerId });
	return true;
}

/**
 * A new chat with a fresh id, belonging to `ownerId` (the signed-in account, or null). Nothing is
 * stored until its first reply finishes.
 */
export function openNewChat(
	options: Omit<OpenChatOptions, "messages" | "ownerId"> & {
		ownerId: string | null;
	},
) {
	return openChat(crypto.randomUUID(), options);
}

/** Deletes a chat from this browser, stopping its reply first so the reply can't save it again. */
export async function deleteChat(
	id: string,
	store: ChatStore = chatStore(),
): Promise<void> {
	closeChat(id);
	await store.deleteChat(id);
}

export async function deleteChats(
	ids: readonly string[],
	store: ChatStore = chatStore(),
): Promise<void> {
	await Promise.all(ids.map((id) => deleteChat(id, store)));
}

/** Moves chats to another owner, in the store and in this tab. */
export async function setChatOwner(
	ids: readonly string[],
	ownerId: string | null,
	store: ChatStore = chatStore(),
): Promise<void> {
	await store.setOwner(ids, ownerId);
	for (const id of ids) {
		const open = openChats.get(id);
		if (open) openChats.set(id, { ...open, ownerId });
	}
}
