import { useLocation } from "@tanstack/react-router";
import { useChatList } from "@/components/sidebar/use-chat-list";
import { useWorkspaceList } from "@/components/sidebar/use-workspace-list";
import { useViewer } from "@/lib/account";
import {
	browserAsksNotToTrack,
	useAnalyticsEnabled,
} from "@/lib/analytics/consent";
import { useAppearance } from "@/lib/appearance/store";
import { ACTION_COMMANDS, toggleCommands } from "@/lib/commands/app-commands";
import type { Command, CommandContext } from "@/lib/commands/command";
import {
	chatCommands,
	layoutCommands,
	settingsCommands,
} from "@/lib/commands/data-commands";
import { useSavedLayouts } from "@/lib/workspaces/saved-layouts";
import { sidebarEntries } from "@/lib/workspaces/sidebar-entries";

/**
 * Every command the palette can list right now. Chats come from the ChatStore through the viewer, so
 * another account's chats never appear (src/lib/storage/CLAUDE.md); none show until the session is known.
 */
export function usePaletteCommands(): {
	commands: Command[];
	context: CommandContext;
	chatsFailed: boolean;
} {
	const list = useChatList();
	const workspaces = useWorkspaceList();
	const viewer = useViewer();
	const layouts = useSavedLayouts();
	const appearance = useAppearance();
	const analyticsEnabled = useAnalyticsEnabled();
	const pathname = useLocation({ select: (location) => location.pathname });

	const entries =
		list.status === "ready" && viewer !== undefined
			? sidebarEntries(list.chats, workspaces, viewer)
			: [];
	const commands = [
		...ACTION_COMMANDS,
		...layoutCommands(layouts),
		...chatCommands(entries),
		...settingsCommands(),
		...toggleCommands({
			theme: appearance.theme,
			density: appearance.density,
			analytics: browserAsksNotToTrack() ? null : analyticsEnabled,
		}),
	];
	return {
		commands,
		context: { pathname },
		chatsFailed: list.status === "error",
	};
}
