import { useLocation } from "@tanstack/react-router";
import { useLocalModels } from "@/components/models/use-local-models";
import { useChatList } from "@/components/sidebar/use-chat-list";
import { useWorkspaceList } from "@/components/sidebar/use-workspace-list";
import { useViewer } from "@/lib/account";
import {
	browserAsksNotToTrack,
	useAnalyticsEnabled,
} from "@/lib/analytics/consent";
import { useAppearance } from "@/lib/appearance/store";
import {
	ACTION_COMMANDS,
	switchThemeCommand,
	toggleCommands,
} from "@/lib/commands/app-commands";
import type { Command, CommandContext } from "@/lib/commands/command";
import {
	chatCommands,
	layoutCommands,
	settingsCommands,
} from "@/lib/commands/data-commands";
import {
	type LocalModelList,
	PANE_COMMAND_IDS,
	paneCommands,
} from "@/lib/commands/pane-commands";
import { usePrompts } from "@/lib/prompts/use-prompts";
import { useFocusedPaneState } from "@/lib/workspaces/focused-pane";
import { useSavedLayouts } from "@/lib/workspaces/saved-layouts";
import { sidebarEntries } from "@/lib/workspaces/sidebar-entries";

/** What saved local servers report, asked only while the model page shows (never on a page load). */
function useLocalModelLists(asking: boolean): LocalModelList[] {
	const local = useLocalModels(asking);
	return local.endpoints.map(({ endpoint, list }) => ({
		endpointId: endpoint.id,
		endpointName: endpoint.name,
		models: list?.ok ? list.models : [],
	}));
}

/**
 * Every command the palette can list right now, with `page` the nested page showing (its opener's id). Chats come from the ChatStore through the viewer, so
 * another account's chats never appear (src/lib/storage/CLAUDE.md); none show until the session is known.
 */
export function usePaletteCommands(page: string | null): {
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
	const { focused, panes } = useFocusedPaneState();
	const prompts = usePrompts();
	const localModels = useLocalModelLists(page === PANE_COMMAND_IDS.switchModel);

	const entries =
		list.status === "ready" && viewer !== undefined
			? sidebarEntries(list.chats, workspaces, viewer)
			: [];
	const commands = [
		...ACTION_COMMANDS,
		...paneCommands({
			pane: focused,
			panes,
			prompts: prompts.status === "ready" ? prompts.prompts : [],
			localModels,
		}),
		switchThemeCommand(appearance),
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
		context: { pathname, pane: focused },
		chatsFailed: list.status === "error",
	};
}
