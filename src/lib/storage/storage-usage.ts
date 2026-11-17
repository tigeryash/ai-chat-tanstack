import type { ChatStore, ChatSummary } from "./chat-store";
import { type Viewer, visibleChats } from "./ownership";

// Settings → Your data (Refine S11): what this viewer keeps on this device. Counts only the chats the
// viewer can see (ownership.ts), so another account's chats in this browser never show up here.

export interface LocalChatUsage {
	chats: number;
	attachments: number;
}

/** The viewer's chats among `chats` (a `listChats()` result), and how many files they keep. */
export async function localChatUsage(
	store: ChatStore,
	chats: readonly ChatSummary[],
	viewer: Viewer,
): Promise<LocalChatUsage> {
	const ids = visibleChats(chats, viewer).map((chat) => chat.id);
	return {
		chats: ids.length,
		attachments: await store.countAttachments(ids),
	};
}

/**
 * Calls `onChange` with the viewer's usage now and after every change to chats, from any tab, until
 * the returned function is called.
 */
export function watchLocalChatUsage(
	store: ChatStore,
	viewer: Viewer,
	onChange: (usage: LocalChatUsage) => void,
	onError: (error: unknown) => void,
): () => void {
	let latest = 0;
	return store.watchChats((chats) => {
		// Counting is async: a slower count for an older list must not overwrite a newer one.
		const run = ++latest;
		localChatUsage(store, chats, viewer).then((usage) => {
			if (run === latest) onChange(usage);
		}, onError);
	}, onError);
}
