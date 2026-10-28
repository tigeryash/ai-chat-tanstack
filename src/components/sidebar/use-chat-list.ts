import { useEffect, useState } from "react";
import { chatStore } from "@/lib/chat/chat-sessions";
import { logError } from "@/lib/log";
import type { ChatStore, ChatSummary } from "@/lib/storage/chat-store";

export type ChatListState =
	| { status: "loading" }
	| { status: "ready"; chats: ChatSummary[] }
	| { status: "error" };

/** This browser's chats, kept current as chats save, rename or delete (in any tab). */
export function useChatList(store: ChatStore = chatStore()): ChatListState {
	const [state, setState] = useState<ChatListState>({ status: "loading" });
	useEffect(
		() =>
			store.watchChats(
				(chats) => setState({ status: "ready", chats }),
				(error) => {
					logError("Couldn't read the chat list:", error);
					setState({ status: "error" });
				},
			),
		[store],
	);
	return state;
}
