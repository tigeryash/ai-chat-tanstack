import type { ChatSummary } from "@/lib/storage/chat-store";
import type { WorkspaceSummary } from "@/lib/storage/workspace";

// The sidebar shows a workspace as one entry (roadmap 3.1): its first saved pane chat stands for it,
// with the workspace's pane count, and its other chats aren't listed on their own. A workspace with no
// saved chat yet (no reply) isn't listed. A chat in two workspaces goes with the newer one.

export interface SidebarEntry extends ChatSummary {
	workspace?: { id: string; chatIds: string[]; paneCount: number };
}

export function sidebarEntries(
	chats: readonly ChatSummary[],
	workspaces: readonly WorkspaceSummary[],
): SidebarEntry[] {
	const byId = new Map(chats.map((chat) => [chat.id, chat]));
	const folded = new Set<string>();
	const entries: SidebarEntry[] = [];
	for (const workspace of [...workspaces].sort(
		(a, b) => b.updatedAt - a.updatedAt,
	)) {
		const ids = workspace.chatIds.filter((id) => !folded.has(id));
		const saved = ids.flatMap((id) => byId.get(id) ?? []);
		const lead = saved[0];
		if (!lead) continue;
		for (const id of ids) folded.add(id);
		entries.push({
			...lead,
			updatedAt: Math.max(...saved.map((chat) => chat.updatedAt)),
			workspace: {
				id: workspace.id,
				chatIds: workspace.chatIds,
				paneCount: workspace.chatIds.length,
			},
		});
	}
	return [...entries, ...chats.filter((chat) => !folded.has(chat.id))];
}
