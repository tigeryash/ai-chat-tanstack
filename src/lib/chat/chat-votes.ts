import { useSyncExternalStore } from "react";
import { logError } from "@/lib/log";
import type { ChatStore } from "@/lib/storage/chat-store";
import { type ChatVotes, type ReplyVote, withVote } from "@/lib/storage/votes";

// Thumbs up/down on replies (roadmap 3.4). Open chats' votes live here; saved chats keep theirs on
// their ChatStore row (an unsaved chat's are written when its first reply saves it, by
// `chat-sessions.ts`). Votes stay on this device: no analytics event carries them (hard rule 4).

// Replaced, never changed in place, so it works as a `useSyncExternalStore` snapshot.
let byChat: ReadonlyMap<string, ChatVotes> = new Map();
const listeners = new Set<() => void>();

function update(chatId: string, votes: ChatVotes | undefined) {
	const next = new Map(byChat);
	if (votes) next.set(chatId, votes);
	else next.delete(chatId);
	byChat = next;
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** A chat's votes in this tab, if it has any. */
export function chatVotesOf(chatId: string): ChatVotes | undefined {
	return byChat.get(chatId);
}

/** Called when a saved chat opens. */
export function loadChatVotes(chatId: string, votes: ChatVotes | undefined) {
	if (!votes || byChat.has(chatId)) return;
	update(chatId, votes);
}

/** Sets (or, with null, clears) the vote on a reply, here and in the store. */
export function voteOnReply(
	chatId: string,
	messageId: string,
	vote: ReplyVote | null,
	store: ChatStore,
): Promise<void> {
	const votes = withVote(byChat.get(chatId), messageId, vote);
	update(chatId, votes);
	return store
		.setVotes(chatId, votes)
		.catch((error) => logError("Couldn't save the vote:", error));
}

/** Forgets a chat's votes in this tab (after the chat is deleted). */
export function forgetChatVotes(chatId: string) {
	if (byChat.has(chatId)) update(chatId, undefined);
}

/** The vote on one reply, re-rendering when it changes. */
export function useReplyVote(
	chatId: string,
	messageId: string,
): ReplyVote | undefined {
	return useSyncExternalStore(
		subscribe,
		() => byChat.get(chatId)?.[messageId],
		() => undefined,
	);
}
