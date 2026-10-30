import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { LogOutIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { removeAccountChats } from "@/lib/chat/chat-ownership";
import { isOpenChatVisibleTo } from "@/lib/chat/open-chats";
import { logError } from "@/lib/log";
import { chatsOwnedBy } from "@/lib/storage/ownership";
import { useChatList } from "./use-chat-list";

// Signing out (roadmap 1.9). A plain sign-out hides the account's chats: they stay in this browser
// and come back at its next sign-in here. The menu also offers to delete them from this browser
// first. Chats made signed out are left alone either way.

export function SignOutItem({ userId }: { userId: string }) {
	const router = useRouter();
	const navigate = useNavigate();
	const { chatId: activeId } = useParams({ strict: false });
	const [confirmingRemove, setConfirmingRemove] = useState(false);
	const [failed, setFailed] = useState(false);

	const run = async (removeChats: boolean) => {
		setFailed(false);
		try {
			// Leave a chat that's about to be hidden or deleted, so it doesn't stay on screen.
			if (activeId && !isOpenChatVisibleTo(activeId, null)) {
				await navigate({ to: "/new" });
			}
			if (removeChats) await removeAccountChats(userId);
			const { error } = await authClient.signOut();
			if (error)
				throw new Error(`Sign-out failed: ${error.code ?? error.status}`);
			// Re-runs the root `beforeLoad`, so the route context sees the session is gone.
			await router.invalidate();
		} catch (error) {
			logError("Couldn't sign out:", error);
			setFailed(true);
		}
	};

	return (
		<SidebarMenuItem>
			<SidebarMenuButton onClick={() => void run(false)}>
				<LogOutIcon />
				Sign out
			</SidebarMenuButton>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={<SidebarMenuAction aria-label="More ways to sign out" />}
				>
					<MoreHorizontalIcon />
				</DropdownMenuTrigger>
				<DropdownMenuContent side="right" align="end" className="w-auto">
					<DropdownMenuItem
						variant="destructive"
						onClick={() => setConfirmingRemove(true)}
					>
						<Trash2Icon />
						Sign out and remove my chats from this device
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			{failed && (
				<p role="alert" className="px-2 py-1 text-sm text-destructive">
					Couldn't sign out. Try again.
				</p>
			)}
			<AlertDialog open={confirmingRemove} onOpenChange={setConfirmingRemove}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Remove your chats from this device?
						</AlertDialogTitle>
						<RemoveChatsDescription userId={userId} />
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								setConfirmingRemove(false);
								void run(true);
							}}
						>
							Sign out and remove
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</SidebarMenuItem>
	);
}

/** Rendered only while the dialog is open, so the count is read then. */
function RemoveChatsDescription({ userId }: { userId: string }) {
	const list = useChatList();
	const count =
		list.status === "ready" ? chatsOwnedBy(list.chats, userId).length : 0;
	const removed =
		count === 0
			? "There are no chats from your account in this browser, so you'll just be signed out."
			: `${count === 1 ? "1 chat" : `${count} chats`} from your account will be deleted from this browser, then you'll be signed out. Your account doesn't keep a copy yet, so this can't be undone.`;
	return (
		<AlertDialogDescription>
			{`${removed} `}
			Chats not saved to an account stay. A plain Sign out only hides your
			chats: they stay in this browser, where anyone using it could still find
			them.
		</AlertDialogDescription>
	);
}
