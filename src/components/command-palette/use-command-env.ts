import { useNavigate } from "@tanstack/react-router";
import { useSidebar } from "@/components/ui/sidebar";
import { currentViewer } from "@/lib/account";
import type { CommandEnv } from "@/lib/commands/command";
import { useSettingsNavigation } from "@/lib/settings/navigation";

/** The palette's side of the registry: commands act through the router and the app's stores. */
export function useCommandEnv(): CommandEnv {
	const navigate = useNavigate();
	const settings = useSettingsNavigation();
	const { isMobile, setOpenMobile, toggleSidebar } = useSidebar();
	// On a phone the sidebar is a sheet over the page; going somewhere closes it.
	const leave = () => {
		if (isMobile) setOpenMobile(false);
	};

	return {
		goTo: async (path) => {
			leave();
			await navigate({ to: path });
		},
		openChat: async (chatId) => {
			leave();
			await navigate({ to: "/$chatId", params: { chatId } });
		},
		openWorkspace: async (workspaceId) => {
			leave();
			await navigate({ to: "/w/$workspaceId", params: { workspaceId } });
		},
		openLayout: async (panes) => {
			// The chat engine loads only when a layout opens (bundle budget).
			const [{ createWorkspaceWith }, viewer] = await Promise.all([
				import("@/lib/workspaces/workspace-sessions"),
				currentViewer(),
			]);
			const workspaceId = await createWorkspaceWith(panes, viewer);
			leave();
			await navigate({ to: "/w/$workspaceId", params: { workspaceId } });
		},
		openSettings: (section, setting) => settings.open(section, setting),
		toggleSidebar,
	};
}
