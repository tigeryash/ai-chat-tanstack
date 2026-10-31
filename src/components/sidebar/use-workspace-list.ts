import { useEffect, useState } from "react";
import { logError } from "@/lib/log";
import { chatStore } from "@/lib/storage/app-store";
import type { ChatStore } from "@/lib/storage/chat-store";
import type { WorkspaceSummary } from "@/lib/storage/workspace";

/**
 * This browser's workspaces (roadmap 3.1), kept current like the chat list. An unreadable list reads as
 * none, so the chats still show one by one.
 */
export function useWorkspaceList(
	store: ChatStore = chatStore(),
): WorkspaceSummary[] {
	const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
	useEffect(
		() =>
			store.watchWorkspaces(setWorkspaces, (error) => {
				logError("Couldn't read the workspace list:", error);
				setWorkspaces([]);
			}),
		[store],
	);
	return workspaces;
}
