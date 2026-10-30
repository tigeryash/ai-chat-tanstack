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
import { deleteChat } from "@/lib/chat/open-chats";
import { logError } from "@/lib/log";
import { chatStore } from "@/lib/storage/app-store";
import type { ChatSummary } from "@/lib/storage/chat-store";
import { type Viewer, visibleChats } from "@/lib/storage/ownership";
import { AccountLinks } from "./account-links";
import { ChatListItem } from "./chat-list-item";
import { type ChatListState, useChatList } from "./use-chat-list";

// The app's sidebar (roadmap 1.4): this browser's chats from the ChatStore, newest first with pinned
// ones on top, plus new chat, search, and the account links. On narrow screens it's a sheet behind
// the header's toggle. It lists only the chats the viewer may see (roadmap 1.9): signed in, their
// account's chats and the ones made signed out, which get a quiet marker.

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
	const { chatId: activeId } = useParams({ strict: false });

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
	const actionsFor = (chat: ChatSummary) => ({
		onRename: (title: string) => run(chatStore().renameChat(chat.id, title)),
		onTogglePin: () => run(chatStore().setPinned(chat.id, !chat.pinned)),
		onDelete: () =>
			run(
				(async () => {
					if (chat.id === activeId) await navigate({ to: "/new" });
					await deleteChat(chat.id);
				})(),
			),
	});

	const visible = visibleChats(list.chats, viewer);
	const { pinned, recent } = arrangeChats(visible, query);
	const renderGroup = (label: string, chats: ChatSummary[]) =>
		chats.length > 0 && (
			<SidebarGroup>
				<SidebarGroupLabel>{label}</SidebarGroupLabel>
				<SidebarGroupContent>
					<SidebarMenu aria-label={`${label} chats`}>
						{chats.map((chat) => (
							<ChatListItem
								key={chat.id}
								chat={chat}
								active={chat.id === activeId}
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
