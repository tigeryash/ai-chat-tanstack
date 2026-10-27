import { Chat } from "@ai-sdk/react";
import type { ChatTransport, UIMessage } from "ai";
import { logError } from "@/lib/log";
import type { ChatStore } from "@/lib/storage/chat-store";
import { createDexieChatStore } from "@/lib/storage/dexie-chat-store";
import { requestPersistentStorage } from "@/lib/storage/persistence";
import { BrowserChatTransport } from "./browser-transport";

// Open chats in this tab, by chat id. A chat keeps streaming while the person moves between routes
// (`/new` hands its chat to `/$chatId` mid-reply), so the `Chat` objects live here, not in a component.
// Chats are saved to the local ChatStore once each reply finishes (roadmap decision 11).

let defaultStore: ChatStore | undefined;
/** The app's one chat store. Browser only: chat routes don't render on the server. */
export function chatStore(): ChatStore {
	defaultStore ??= createDexieChatStore();
	return defaultStore;
}

const openChats = new Map<string, Chat<UIMessage>>();
const defaultTransport = new BrowserChatTransport();

export interface OpenChatOptions {
	messages?: UIMessage[];
	transport?: ChatTransport<UIMessage>;
	store?: ChatStore;
}

/** Saves the whole chat. The first save asks the browser to keep our storage (decision 9). */
export async function saveChat(
	store: ChatStore,
	chatId: string,
	messages: UIMessage[],
): Promise<void> {
	if (messages.length === 0) return;
	try {
		const { created } = await store.saveMessages(chatId, messages);
		if (created) await requestPersistentStorage();
	} catch (error) {
		logError("Couldn't save the chat in this browser:", error);
	}
}

/** The open chat with this id, creating it (with `messages`) if this tab hasn't opened it yet. */
export function openChat(id: string, options: OpenChatOptions = {}) {
	const existing = openChats.get(id);
	if (existing) return existing;
	const store = options.store ?? chatStore();
	const chat = new Chat<UIMessage>({
		id,
		messages: options.messages,
		transport: options.transport ?? defaultTransport,
		// Stopped and failed replies are saved too, so nothing the person typed is lost.
		onFinish: ({ messages }) => saveChat(store, id, messages),
	});
	openChats.set(id, chat);
	return chat;
}

export function isChatOpen(id: string): boolean {
	return openChats.has(id);
}

/** Opens a saved chat. Resolves false when there's no such chat in this browser. */
export async function openSavedChat(
	id: string,
	store: ChatStore = chatStore(),
): Promise<boolean> {
	if (openChats.has(id)) return true;
	const saved = await store.getChat(id);
	if (!saved) return false;
	openChat(id, { messages: saved.messages, store });
	return true;
}

/** A new chat with a fresh id. Nothing is stored until its first reply finishes. */
export function openNewChat(options: Omit<OpenChatOptions, "messages"> = {}) {
	return openChat(crypto.randomUUID(), options);
}
