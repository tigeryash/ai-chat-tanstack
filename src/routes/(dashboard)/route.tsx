import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BackgroundStatus } from "@/components/background-status/background-status";
import { NoAccountChatsPrompt } from "@/components/chat-ownership/no-account-chats-prompt";
import { HeaderSlot } from "@/components/header-slot";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

// The app around the chat and settings pages. No login wall (decision 4): keys and chats live in this
// browser, so everything here works signed out. Rendered in the browser only (decision 12), like the
// pages inside it, since the sidebar reads chats from IndexedDB.
export const Route = createFileRoute("/(dashboard)")({
	ssr: false,
	component: DashboardLayout,
});

function DashboardLayout() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="h-svh overflow-hidden">
				<header className="flex h-12 shrink-0 items-center gap-2 px-2">
					<SidebarTrigger aria-label="Toggle sidebar" />
					<HeaderSlot />
				</header>
				<div className="min-h-0 flex-1 px-3 pb-3">
					<Outlet />
				</div>
			</SidebarInset>
			<BackgroundStatus />
			<NoAccountChatsPrompt />
		</SidebarProvider>
	);
}
