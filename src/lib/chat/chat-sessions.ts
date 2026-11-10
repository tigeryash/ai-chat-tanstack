import { Chat } from "@ai-sdk/react";
import type { ChatTransport, UIMessage } from "ai";
import {
	reportReplyEnded,
	setReplying,
} from "@/lib/background-status/activity";
import { logError } from "@/lib/log";
import { chatStore } from "@/lib/storage/app-store";
import type { ChatBranches } from "@/lib/storage/branches";
import type { ChatStore, NewChatFields } from "@/lib/storage/chat-store";
import { isVisibleTo, type Viewer } from "@/lib/storage/ownership";
import { requestPersistentStorage } from "@/lib/storage/persistence";
import { BrowserChatTransport, type ResolveModel } from "./browser-transport";
import { chatBranchesOf, loadChatBranches } from "./chat-branches";
import { chatSettingsOf, loadChatSettings } from "./chat-settings";
import { titleFromMessages } from "./chat-title";
import { writeChatTitle } from "./chat-title-writer";
import { chatVotesOf, loadChatVotes } from "./chat-votes";
import { resolveAppModel } from "./e2e-model";
import { addOpenChat, getOpenChat, peekOpenChat } from "./open-chats";
import { titleModelChoice } from "./title-model";

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
	/** Resolves the title model (roadmap R2 S2); tests swap in a mock. */
	resolveTitleModel?: ResolveModel;
}

/** Chats opened empty in this tab: never saved, so their first save names them. */
const unsavedChats = new Set<string>();
/** Titles being written by the title model, by chat id, until the chat's first save. */
const pendingTitles = new Map<string, Promise<string>>();

/**
 * Starts writing a new chat's title as its first message is sent, so it's usually ready by the time
 * the reply is saved. Only with a title model set (Settings → General); once per chat.
 */
function startTitle(chat: Chat<UIMessage>, resolveModel: ResolveModel) {
	if (!unsavedChats.has(chat.id) || pendingTitles.has(chat.id)) return;
	const choice = titleModelChoice();
	if (!choice) return;
	pendingTitles.set(
		chat.id,
		writeChatTitle({ messages: chat.messages, choice, resolveModel }),
	);
}

/**
 * Saves the whole chat. The first save names the chat after its first message (roadmap 1.4) and asks
 * the browser to keep our storage (decision 9). A chat that's already saved keeps its owner.
 */
export function saveChat(
	store: ChatStore,
	chatId: string,
	messages: UIMessage[],
	ownerId: string | null,
): Promise<void> {
	if (messages.length === 0) return Promise.resolve();
	// What to save is read now, and writes to one chat run in order, so a later save (a regenerate put
	// back after its reply failed, roadmap R4) never lands under an earlier one still in flight.
	const write = writeChat(store, chatId, messages, ownerId, {
		branches: chatBranchesOf(chatId),
		title: pendingTitles.get(chatId) ?? titleFromMessages(messages),
		settings: chatSettingsOf(chatId),
		votes: chatVotesOf(chatId),
	});
	const previous = pendingSaves.get(chatId) ?? Promise.resolve();
	const saved = previous.then(write);
	pendingSaves.set(chatId, saved);
	void saved.then(() => {
		if (pendingSaves.get(chatId) === saved) pendingSaves.delete(chatId);
	});
	return saved;
}

const pendingSaves = new Map<string, Promise<void>>();

function writeChat(
	store: ChatStore,
	chatId: string,
	messages: UIMessage[],
	ownerId: string | null,
	{
		branches,
		title,
		...extras
	}: Omit<NewChatFields, "title"> & {
		branches: ChatBranches | undefined;
		title: string | Promise<string>;
	},
) {
	return async (): Promise<void> => {
		try {
			// Branches this tab never loaded are left as stored (roadmap 1.7). A new chat gets its title, and
			// the settings (roadmap 2.4b) and votes (roadmap 3.4) that had nowhere to go before its first
			// reply, in the same write: the SDK reports "ready" before this runs, so the page may be left
			// mid-save, and a separate later write would leave the chat "New chat" for good.
			// A title the title model is still writing is waited for (it falls back to the first line on
			// its own, after at most TITLE_TIMEOUT_MS), so it lands in this same write.
			const { created } = await store.saveMessages(
				chatId,
				messages,
				ownerId,
				branches,
				{ ...extras, title: await title },
			);
			unsavedChats.delete(chatId);
			pendingTitles.delete(chatId);
			if (!created) return;
			await requestPersistentStorage();
		} catch (error) {
			logError("Couldn't save the chat in this browser:", error);
		}
	};
}

/** The open chat with this id, creating it (with `messages`) if this tab hasn't opened it yet. */
export function openChat(id: string, options: OpenChatOptions = {}) {
	const existing = getOpenChat(id);
	if (existing) return existing.chat;
	const store = options.store ?? chatStore();
	const resolveTitleModel = options.resolveTitleModel ?? resolveAppModel;
	if (!options.messages?.length) unsavedChats.add(id);
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
	chat["~registerStatusCallback"](() => {
		setReplying(id, chat.status === "submitted" || chat.status === "streaming");
		if (chat.status === "submitted" && peekOpenChat(id)?.chat === chat) {
			startTitle(chat, resolveTitleModel);
		}
	});
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
	loadChatVotes(id, saved.votes);
	loadChatBranches(id, saved.branches);
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
