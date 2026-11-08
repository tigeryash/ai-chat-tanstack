import type { ChatSummary } from "@/lib/storage/chat-store";
import { isVisibleTo, type Viewer } from "@/lib/storage/ownership";
import type { WorkspaceSummary } from "@/lib/storage/workspace";

// The sidebar shows a workspace as one entry (roadmap 3.1): its first saved pane chat stands for it,
// with the workspace's pane count, and its other chats aren't listed on their own. A workspace with no
// saved chat yet (no reply) isn't listed. A chat in two workspaces goes with the newer one. Only what
// `viewer` may see counts (roadmap 1.9): another account's chats in a workspace are neither its lead
// nor in its pane count (quality audit Q2, W3).

export interface SidebarEntry extends ChatSummary {
	workspace?: { id: string; paneCount: number };
}

/** `chats` and `workspaces`: everything stored; this leaves out what `viewer` can't see. */
export function sidebarEntries(
	chats: readonly ChatSummary[],
	workspaces: readonly WorkspaceSummary[],
	viewer: Viewer,
): SidebarEntry[] {
	const visible = chats.filter((chat) => isVisibleTo(chat, viewer));
	const byId = new Map(visible.map((chat) => [chat.id, chat]));
	const hidden = new Set(
		chats.filter((chat) => !byId.has(chat.id)).map((chat) => chat.id),
	);
	const folded = new Set<string>();
	const entries: SidebarEntry[] = [];
	for (const workspace of workspaces
		.filter((workspace) => isVisibleTo(workspace, viewer))
		.sort((a, b) => b.updatedAt - a.updatedAt)) {
		const shown = workspace.chatIds.filter((id) => !hidden.has(id));
		const ids = shown.filter((id) => !folded.has(id));
		const saved = ids.flatMap((id) => byId.get(id) ?? []);
		const lead = saved[0];
		if (!lead) continue;
		for (const id of ids) folded.add(id);
		entries.push({
			...lead,
			updatedAt: Math.max(...saved.map((chat) => chat.updatedAt)),
			workspace: { id: workspace.id, paneCount: shown.length },
		});
	}
	return [...entries, ...visible.filter((chat) => !folded.has(chat.id))];
}
