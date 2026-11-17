import { LogOutIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { RemoveChatsDialog } from "@/components/account/remove-chats-dialog";
import { useSignOut } from "@/components/account/use-sign-out";
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

// Signing out from the sidebar (roadmap 1.9): a plain sign-out, and a menu that offers to delete the
// account's chats from this browser first. Settings → Account offers the same two.

export function SignOutItem({ userId }: { userId: string }) {
	const { signOut, failed } = useSignOut(userId);
	const [confirmingRemove, setConfirmingRemove] = useState(false);

	return (
		<SidebarMenuItem>
			<SidebarMenuButton onClick={() => void signOut(false)}>
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
			<RemoveChatsDialog
				userId={userId}
				open={confirmingRemove}
				onOpenChange={setConfirmingRemove}
				onConfirm={() => void signOut(true)}
			/>
		</SidebarMenuItem>
	);
}
