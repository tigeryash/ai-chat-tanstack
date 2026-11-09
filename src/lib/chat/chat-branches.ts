import { useSyncExternalStore } from "react";
import { type ChatBranches, EMPTY_BRANCHES } from "@/lib/storage/branches";

// Open chats' branches (roadmap 1.7): the other versions of edited messages, which the AI SDK `Chat`
// doesn't hold (it has only the path shown). Loaded when a saved chat opens, saved with the chat by
// `chat-sessions.ts`. A chat this tab never loaded has none here, and saving it keeps the stored ones.
// Imports nothing from the AI SDK at runtime, so `open-chats.ts` can forget them.

// Replaced, never changed in place, so it works as a `useSyncExternalStore` snapshot (and the React
// Compiler, which memoizes on identity, sees every change).
let all: ReadonlyMap<string, ChatBranches> = new Map();
const listeners = new Set<() => void>();

function update(chatId: string, branches: ChatBranches | undefined) {
	const next = new Map(all);
	if (branches) next.set(chatId, branches);
	else next.delete(chatId);
	all = next;
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Undefined when this tab hasn't loaded or made any for the chat. */
export function chatBranchesOf(chatId: string): ChatBranches | undefined {
	return all.get(chatId);
}

/** Called when a saved chat opens (again, after this tab released it): the store's copy wins. */
export function loadChatBranches(
	chatId: string,
	branches: ChatBranches | undefined,
) {
	update(chatId, branches ?? EMPTY_BRANCHES);
}

export function setChatBranches(chatId: string, branches: ChatBranches) {
	update(chatId, branches);
}

/** Forgets a chat's branches in this tab (after the chat is closed or deleted). */
export function forgetChatBranches(chatId: string) {
	if (all.has(chatId)) update(chatId, undefined);
}

export function useChatBranches(chatId: string): ChatBranches {
	return useSyncExternalStore(
		subscribe,
		() => all.get(chatId) ?? EMPTY_BRANCHES,
	);
}
