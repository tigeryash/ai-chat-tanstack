import { Link } from "@tanstack/react-router";
import {
	HardDriveIcon,
	MoreHorizontalIcon,
	PencilIcon,
	PinIcon,
	PinOffIcon,
	Trash2Icon,
} from "lucide-react";
import { useRef, useState } from "react";
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
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarInput,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { displayTitle } from "@/lib/chat/chat-list";
import type { ChatSummary } from "@/lib/storage/chat-store";
import { MAX_TITLE_LENGTH } from "@/lib/storage/format";

const NO_ACCOUNT_LABEL = "Not saved to an account";

export interface ChatListItemActions {
	onRename: (title: string) => void;
	onTogglePin: () => void;
	onDelete: () => void;
}

/**
 * One chat in the sidebar: a link, plus rename, pin and delete (with a confirm) in its menu.
 * `noAccount` marks a chat made signed out while someone is signed in (roadmap 1.9).
 */
export function ChatListItem({
	chat,
	active,
	noAccount = false,
	onRename,
	onTogglePin,
	onDelete,
}: {
	chat: ChatSummary;
	active: boolean;
	noAccount?: boolean;
} & ChatListItemActions) {
	const { setOpenMobile } = useSidebar();
	const [renaming, setRenaming] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const title = displayTitle(chat);

	return (
		<SidebarMenuItem data-chat-id={chat.id}>
			{renaming ? (
				<RenameInput
					initial={chat.title}
					onDone={(next) => {
						setRenaming(false);
						if (next && next !== chat.title) onRename(next);
					}}
				/>
			) : (
				<SidebarMenuButton
					isActive={active}
					render={
						<Link
							to="/$chatId"
							params={{ chatId: chat.id }}
							onClick={() => setOpenMobile(false)}
						/>
					}
				>
					{chat.pinned && (
						<PinIcon aria-label="Pinned" className="text-muted-foreground" />
					)}
					<span className="truncate">{title}</span>
					{noAccount && (
						<span title={NO_ACCOUNT_LABEL} className="ml-auto flex">
							<HardDriveIcon
								role="img"
								aria-label={NO_ACCOUNT_LABEL}
								className="text-muted-foreground/70"
							/>
						</span>
					)}
				</SidebarMenuButton>
			)}
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<SidebarMenuAction
							showOnHover
							aria-label={`Options for ${title}`}
						/>
					}
				>
					<MoreHorizontalIcon />
				</DropdownMenuTrigger>
				<DropdownMenuContent side="right" align="start">
					<DropdownMenuItem onClick={() => setRenaming(true)}>
						<PencilIcon />
						Rename
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onTogglePin}>
						{chat.pinned ? <PinOffIcon /> : <PinIcon />}
						{chat.pinned ? "Unpin" : "Pin"}
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onClick={() => setConfirmingDelete(true)}
					>
						<Trash2Icon />
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this chat?</AlertDialogTitle>
						<AlertDialogDescription>
							“{title}” will be deleted from this browser. This can't be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								setConfirmingDelete(false);
								onDelete();
							}}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</SidebarMenuItem>
	);
}

/** Enter or leaving the field saves; Escape (or an empty title) cancels. */
function RenameInput({
	initial,
	onDone,
}: {
	initial: string;
	onDone: (title: string | null) => void;
}) {
	const [value, setValue] = useState(initial);
	// Escape unmounts the field, and a blur may still follow: answer only once.
	const done = useRef(false);
	const finish = (title: string | null) => {
		if (done.current) return;
		done.current = true;
		onDone(title);
	};
	return (
		<SidebarInput
			aria-label="Chat title"
			autoFocus
			maxLength={MAX_TITLE_LENGTH}
			value={value}
			onChange={(event) => setValue(event.target.value)}
			onFocus={(event) => event.target.select()}
			onBlur={() => finish(value.trim())}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					event.currentTarget.blur();
				} else if (event.key === "Escape") {
					event.preventDefault();
					finish(null);
				}
			}}
		/>
	);
}
