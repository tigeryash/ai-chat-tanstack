import { Chat } from "@ai-sdk/react";
import type { ChatTransport, UIMessage } from "ai";
import { logError } from "@/lib/log";
import type { ChatStore } from "@/lib/storage/chat-store";
import { createDexieChatStore } from "@/lib/storage/dexie-chat-store";
import { requestPersistentStorage } from "@/lib/storage/persistence";
import { BrowserChatTransport } from "./browser-transport";
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

const openChats = new Map<string, Chat<UIMessage>>();
const defaultTransport = new BrowserChatTransport(resolveAppModel);

export interface OpenChatOptions {
	messages?: UIMessage[];
	transport?: ChatTransport<UIMessage>;
	store?: ChatStore;
}

/**
 * Saves the whole chat. The first save names the chat after its first message (roadmap 1.4) and asks
 * the browser to keep our storage (decision 9).
 */
export async function saveChat(
	store: ChatStore,
	chatId: string,
	messages: UIMessage[],
): Promise<void> {
	if (messages.length === 0) return;
	try {
		const { created } = await store.saveMessages(chatId, messages);
		if (!created) return;
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
	if (existing) return existing;
	const store = options.store ?? chatStore();
	const chat = new Chat<UIMessage>({
		id,
		messages: options.messages,
		transport: options.transport ?? defaultTransport,
		// Stopped and failed replies are saved too, so nothing the person typed is lost. A closed
		// (deleted) chat isn't, or stopping its reply would bring it back.
		onFinish: ({ messages }) =>
			openChats.get(id) === chat ? saveChat(store, id, messages) : undefined,
	});
	openChats.set(id, chat);
	return chat;
}

/** Stops the chat's reply, if any, and forgets it in this tab (after the chat is deleted). */
export function closeChat(id: string): void {
	const chat = openChats.get(id);
	if (!chat) return;
	openChats.delete(id);
	chat.stop().catch((error) => logError("Couldn't stop the reply:", error));
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

/** Deletes a chat from this browser, stopping its reply first so the reply can't save it again. */
export async function deleteChat(
	id: string,
	store: ChatStore = chatStore(),
): Promise<void> {
	closeChat(id);
	await store.deleteChat(id);
}
