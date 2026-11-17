import { deleteAllChats } from "@/lib/chat/delete-all-chats";
import { chatStore } from "./app-store";
import type { Viewer } from "./ownership";
import { type LocalChatUsage, watchLocalChatUsage } from "./storage-usage";

// Settings → Your data (Refine S11) on the app's own store. Loaded with `import()` from the settings
// dialog, so Dexie stays out of every page's first load.

export function watchUsage(
	viewer: Viewer,
	onChange: (usage: LocalChatUsage) => void,
	onError: (error: unknown) => void,
): () => void {
	return watchLocalChatUsage(chatStore(), viewer, onChange, onError);
}

export function deleteAllLocalChats(viewer: Viewer): Promise<number> {
	return deleteAllChats(viewer);
}
