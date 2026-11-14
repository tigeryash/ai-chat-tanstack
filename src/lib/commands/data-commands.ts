import { displayTitle } from "@/lib/chat/chat-list";
import {
	allSettingMatches,
	visibleSettingsSections,
} from "@/lib/settings/registry";
import type { SavedLayout } from "@/lib/workspaces/saved-layouts";
import type { SidebarEntry } from "@/lib/workspaces/sidebar-entries";
import type { Command } from "./command";

// Commands made from what's stored (roadmap R2 S5): your chats and workspaces, saved layouts, and the
// Settings sections and rows from the settings registry. Chats and layouts carry a `kind`, so neither
// their ids nor their titles reach recency or analytics.

/**
 * One command per sidebar entry, newest first. Pass entries from `sidebarEntries(…, viewer)`, which
 * already leaves out other accounts' chats (src/lib/storage/CLAUDE.md).
 */
export function chatCommands(entries: readonly SidebarEntry[]): Command[] {
	return [...entries]
		.sort((a, b) => b.updatedAt - a.updatedAt)
		.map((entry): Command => {
			const workspace = entry.workspace;
			if (workspace) {
				return {
					id: `workspace:${workspace.id}`,
					kind: "workspace.open",
					title: displayTitle(entry),
					detail: `Workspace, ${workspace.paneCount} panes`,
					keywords: ["workspace"],
					group: "chats",
					run: (env) => env.openWorkspace(workspace.id),
				};
			}
			return {
				id: `chat:${entry.id}`,
				kind: "chat.open",
				title: displayTitle(entry),
				keywords: [],
				group: "chats",
				run: (env) => env.openChat(entry.id),
			};
		});
}

/** "New chat from a saved layout", one per layout, newest first. */
export function layoutCommands(layouts: readonly SavedLayout[]): Command[] {
	return [...layouts].reverse().map(
		(layout): Command => ({
			id: `layout:${layout.id}`,
			kind: "layout.new-chat",
			title: `New chat from layout: ${layout.name}`,
			detail: `${layout.panes.length} panes`,
			keywords: ["layout", "workspace", "create"],
			group: "actions",
			run: (env) => env.openLayout(layout.panes),
		}),
	);
}

/** Every Settings section the nav shows, then every row of the registry (search only). */
export function settingsCommands(): Command[] {
	const sections = visibleSettingsSections().map(
		(section): Command => ({
			id: `settings.${section.id}`,
			title: `${section.label} settings`,
			detail: "Settings",
			keywords: ["settings", "preferences", section.label],
			group: "settings",
			run: (env) => env.openSettings(section.id),
		}),
	);
	const rows = allSettingMatches().map(
		({ setting, section }): Command => ({
			id: `setting.${setting.id}`,
			title: setting.label,
			detail: `Settings / ${section.label}`,
			keywords: setting.keywords,
			group: "settings",
			searchOnly: true,
			run: (env) => env.openSettings(setting.section, setting.id),
		}),
	);
	return [...sections, ...rows];
}
