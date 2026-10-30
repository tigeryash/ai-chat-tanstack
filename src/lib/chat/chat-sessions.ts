import { Chat } from "@ai-sdk/react";
import type { ChatTransport, UIMessage } from "ai";
import {
	reportReplyEnded,
	setReplying,
} from "@/lib/background-status/activity";
import { logError } from "@/lib/log";
import { chatStore } from "@/lib/storage/app-store";
import type { ChatStore } from "@/lib/storage/chat-store";
import { isVisibleTo, type Viewer } from "@/lib/storage/ownership";
import { requestPersistentStorage } from "@/lib/storage/persistence";
import { BrowserChatTransport } from "./browser-transport";
import { chatSettingsOf, loadChatSettings } from "./chat-settings";
import { titleFromMessages } from "./chat-title";
import { resolveAppModel } from "./e2e-model";
import { addOpenChat, getOpenChat, peekOpenChat } from "./open-chats";

// Creates and opens chats; `open-chats.ts` keeps track of them. Chats are saved to the local ChatStore
// once each reply finishes (roadmap decision 11). This module loads the chat engine (the AI SDK and
// the transport), so pages that don't chat import it with `import()`.

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
	const existing = getOpenChat(id);
	if (existing) return existing.chat;
	const store = options.store ?? chatStore();
	const chat = new Chat<UIMessage>({
		id,
		messages: options.messages,
		transport: options.transport ?? defaultTransport,
		// Stopped and failed replies are saved too, so nothing the person typed is lost. A closed
		// (deleted) chat isn't, or stopping its reply would bring it back.
		onFinish: ({ messages, isAbort, isError }) => {
			const open = peekOpenChat(id);
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
			if (peekOpenChat(id)?.chat === chat) {
				reportReplyEnded({ chatId: id, outcome: "failed" });
			}
		},
	});
	// Tab status (roadmap 3.10) counts replies across every open chat. `~registerStatusCallback` is how
	// `useChat` itself watches a `Chat`; there's no other public way to observe it outside React.
	chat["~registerStatusCallback"](() =>
		setReplying(id, chat.status === "submitted" || chat.status === "streaming"),
	);
	addOpenChat(id, { chat, ownerId: options.ownerId ?? null });
	return chat;
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
	const open = getOpenChat(id);
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
