import { useChatList } from "@/components/sidebar/use-chat-list";
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
import { chatsOwnedBy } from "@/lib/storage/ownership";

/** Confirms "sign out and remove my chats from this device" (roadmap 1.9), from the sidebar or Settings. */
export function RemoveChatsDialog({
	userId,
	open,
	onOpenChange,
	onConfirm,
}: {
	userId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
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
							onOpenChange(false);
							onConfirm();
						}}
					>
						Sign out and remove
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
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
