import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { SquarePenIcon } from "lucide-react";
import { useState } from "react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { useViewer } from "@/lib/account";
import { arrangeChats } from "@/lib/chat/chat-list";
import { deleteChat, deleteChats } from "@/lib/chat/open-chats";
import { logError } from "@/lib/log";
import { chatStore } from "@/lib/storage/app-store";
import { type Viewer, visibleChats } from "@/lib/storage/ownership";
import {
	type SidebarEntry,
	sidebarEntries,
} from "@/lib/workspaces/sidebar-entries";
import { AccountLinks } from "./account-links";
import { ChatListItem } from "./chat-list-item";
import { type ChatListState, useChatList } from "./use-chat-list";
import { useWorkspaceList } from "./use-workspace-list";

// The app's sidebar (roadmap 1.4): this browser's chats from the ChatStore, newest first with pinned
// ones on top, plus new chat, search, and the account links. On narrow screens it's a sheet behind
// the header's toggle. It lists only the chats the viewer may see (roadmap 1.9): signed in, their
// account's chats and the ones made signed out, which get a quiet marker. A workspace (roadmap 3.1) is
// one entry with its pane count.

export function AppSidebar() {
	const list = useChatList();
	const viewer = useViewer();
	const [query, setQuery] = useState("");
	const { setOpenMobile } = useSidebar();

	return (
		<Sidebar>
			<SidebarHeader>
				<div className="px-2 pt-1 font-semibold">High Elo LLMs</div>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							render={<Link to="/new" onClick={() => setOpenMobile(false)} />}
						>
							<SquarePenIcon />
							New chat
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				<SidebarInput
					type="search"
					aria-label="Search chats"
					placeholder="Search chats"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
			</SidebarHeader>
			<SidebarContent>
				<ChatGroups list={list} viewer={viewer} query={query} />
			</SidebarContent>
			<SidebarFooter>
				<AccountLinks />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}

function ChatGroups({
	list,
	viewer,
	query,
}: {
	list: ChatListState;
	viewer: Viewer | undefined;
	query: string;
}) {
	const [failed, setFailed] = useState(false);
	const navigate = useNavigate();
	const { chatId: activeChatId, workspaceId: activeWorkspaceId } = useParams({
		strict: false,
	});
	const workspaces = useWorkspaceList();

	if (list.status === "loading" || viewer === undefined) return null;
	if (list.status === "error") {
		return (
			<p role="alert" className="px-4 py-2 text-sm text-destructive">
				Couldn't load your chats from this browser.
			</p>
		);
	}

	const run = (action: Promise<void>) => {
		setFailed(false);
		action.catch((error) => {
			logError("Couldn't update the chat:", error);
			setFailed(true);
		});
	};
	const isActive = (entry: SidebarEntry) =>
		entry.workspace
			? entry.workspace.id === activeWorkspaceId
			: entry.id === activeChatId;
	// Deleting a workspace deletes its chats too: they're listed only as the workspace.
	const remove = async (entry: SidebarEntry) => {
		if (isActive(entry)) await navigate({ to: "/new" });
		if (!entry.workspace) return deleteChat(entry.id);
		await deleteChats(entry.workspace.chatIds);
		await chatStore().deleteWorkspace(entry.workspace.id);
	};
	const actionsFor = (entry: SidebarEntry) => ({
		onRename: (title: string) => run(chatStore().renameChat(entry.id, title)),
		onTogglePin: () => run(chatStore().setPinned(entry.id, !entry.pinned)),
		onDelete: () => run(remove(entry)),
	});

	const visible = sidebarEntries(
		visibleChats(list.chats, viewer),
		visibleChats(workspaces, viewer),
	);
	const { pinned, recent } = arrangeChats(visible, query);
	const renderGroup = (label: string, chats: SidebarEntry[]) =>
		chats.length > 0 && (
			<SidebarGroup>
				<SidebarGroupLabel>{label}</SidebarGroupLabel>
				<SidebarGroupContent>
					<SidebarMenu aria-label={`${label} chats`}>
						{chats.map((chat) => (
							<ChatListItem
								key={chat.workspace?.id ?? chat.id}
								chat={chat}
								active={isActive(chat)}
								noAccount={viewer !== null && chat.ownerId === null}
								{...actionsFor(chat)}
							/>
						))}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		);

	return (
		<>
			{failed && (
				<p role="alert" className="px-4 py-2 text-sm text-destructive">
					Couldn't update that chat. Try again.
				</p>
			)}
			{renderGroup("Pinned", pinned)}
			{renderGroup("Recent", recent)}
			{pinned.length + recent.length === 0 && (
				<p className="px-4 py-2 text-sm text-muted-foreground">
					{visible.length === 0
						? "Your chats will show up here. They stay in this browser."
						: "No chats match your search."}
				</p>
			)}
		</>
	);
}
