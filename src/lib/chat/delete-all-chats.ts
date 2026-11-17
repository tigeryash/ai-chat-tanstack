import { chatStore } from "@/lib/storage/app-store";
import type { ChatStore } from "@/lib/storage/chat-store";
import { type Viewer, visibleChats } from "@/lib/storage/ownership";
import {
	deleteWorkspaceAs,
	dropDeletedPanes,
} from "@/lib/workspaces/workspace-cleanup";
import { deleteChats } from "./open-chats";

// Settings → Your data → Danger zone (Refine S11): delete every chat the viewer can see on this device,
// with their branches, attached files and workspaces. Another account's chats stay (roadmap 1.9: never
// act on what the viewer can't see), and so do saved prompts, keys and settings.

/** Returns how many chats were deleted. */
export async function deleteAllChats(
	viewer: Viewer,
	store: ChatStore = chatStore(),
): Promise<number> {
	const ids = visibleChats(await store.listChats(), viewer).map(
		(chat) => chat.id,
	);
	const workspaces = visibleChats(await store.listWorkspaces(), viewer);
	for (const { id } of workspaces) await deleteWorkspaceAs(id, viewer, store);
	await deleteChats(ids, store);
	await dropDeletedPanes(ids, store);
	return ids.length;
}
