import type { ChatSummary } from "@/lib/storage/chat-store";
import { UNTITLED_CHAT } from "./chat-title";

// The sidebar's order (roadmap 1.4): pinned chats first, each group newest activity first, filtered
// by a title search.

export interface ArrangedChats {
	pinned: ChatSummary[];
	recent: ChatSummary[];
}

export const displayTitle = (chat: Pick<ChatSummary, "title">) =>
	chat.title || UNTITLED_CHAT;

export function arrangeChats(
	chats: readonly ChatSummary[],
	query = "",
): ArrangedChats {
	const needle = query.trim().toLocaleLowerCase();
	const matches = chats
		.filter((chat) => displayTitle(chat).toLocaleLowerCase().includes(needle))
		.sort((a, b) => b.updatedAt - a.updatedAt);
	return {
		pinned: matches.filter((chat) => chat.pinned),
		recent: matches.filter((chat) => !chat.pinned),
	};
}
