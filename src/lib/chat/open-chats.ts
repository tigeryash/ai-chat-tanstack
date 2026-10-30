import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { setReplying } from "@/lib/background-status/activity";
import { logError } from "@/lib/log";
import { chatStore } from "@/lib/storage/app-store";
import type { ChatStore } from "@/lib/storage/chat-store";
import { isVisibleTo, type Viewer } from "@/lib/storage/ownership";

// Open chats in this tab, by chat id. A chat keeps streaming while the person moves between routes
// (`/new` hands its chat to `/$chatId` mid-reply), so the `Chat` objects live here, not in a component.
// `chat-sessions.ts` creates them; this module only keeps track of them, and imports nothing from the
// AI SDK at runtime, so the sidebar can use it without loading the chat engine (quality audit P1).

/** An open chat and who it belongs to (roadmap 1.9), so an unsaved chat has an owner too. */
export interface OpenChat {
	chat: Chat<UIMessage>;
	ownerId: string | null;
}

/**
 * How many chats stay open once idle (quality audit P8). Past this, the least recently used idle chat
 * that isn't on screen is released; it's saved, so opening it again reads it back from the store.
 */
export const MAX_IDLE_OPEN_CHATS = 8;

// In least-recently-used order: `getOpenChat` and `addOpenChat` move a chat to the end.
const openChats = new Map<string, OpenChat>();
// Chats on screen, with how many places show each.
const retained = new Map<string, number>();

/** The open chat with this id, marked as just used. */
export function getOpenChat(id: string): OpenChat | undefined {
	const open = openChats.get(id);
	if (open) {
		openChats.delete(id);
		openChats.set(id, open);
	}
	return open;
}

/** The open chat with this id, without touching its place in the LRU order. */
export function peekOpenChat(id: string): OpenChat | undefined {
	return openChats.get(id);
}

export function addOpenChat(id: string, open: OpenChat): void {
	openChats.delete(id);
	openChats.set(id, open);
	releaseIdleChats();
}

function isBusy({ chat }: OpenChat): boolean {
	return chat.status === "submitted" || chat.status === "streaming";
}

/** Releases the least recently used idle chats that aren't on screen, beyond the limit. */
function releaseIdleChats(): void {
	let excess = openChats.size - MAX_IDLE_OPEN_CHATS;
	for (const [id, open] of openChats) {
		if (excess <= 0) return;
		if (isBusy(open) || retained.has(id)) continue;
		openChats.delete(id);
		excess -= 1;
	}
}

/**
 * Keeps a chat open while it's on screen. Call from an effect; the returned function lets it go.
 * Without this, opening other chats could release the one being shown.
 */
export function retainChat(id: string): () => void {
	retained.set(id, (retained.get(id) ?? 0) + 1);
	let released = false;
	return () => {
		if (released) return;
		released = true;
		const count = (retained.get(id) ?? 1) - 1;
		if (count > 0) retained.set(id, count);
		else retained.delete(id);
	};
}

/** Stops the chat's reply, if any, and forgets it in this tab (after the chat is deleted). */
export function closeChat(id: string): void {
	const open = openChats.get(id);
	if (!open) return;
	openChats.delete(id);
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
