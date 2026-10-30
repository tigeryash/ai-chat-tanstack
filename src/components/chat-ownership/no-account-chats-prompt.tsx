import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useChatList } from "@/components/sidebar/use-chat-list";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useViewer } from "@/lib/account";
import {
	answerNoAccountPrompt,
	type NoAccountChoice,
	useNoAccountPromptAnswered,
} from "@/lib/chat/chat-ownership";
import { logError } from "@/lib/log";
import type { ChatSummary } from "@/lib/storage/chat-store";
import { noAccountChats } from "@/lib/storage/ownership";

/**
 * The one-time question after sign-in (roadmap 1.9): what to do with the chats made signed out in
 * this browser. Each account answers once per browser. Closing it without answering asks again on the
 * next visit. Mounted once in the app layout; renders nothing unless it's due.
 */
export function NoAccountChatsPrompt() {
	const viewer = useViewer();
	const list = useChatList();
	if (!viewer || list.status !== "ready") return null;
	return <PromptFor userId={viewer} chats={list.chats} />;
}

function PromptFor({
	userId,
	chats,
}: {
	userId: string;
	chats: ChatSummary[];
}) {
	const navigate = useNavigate();
	const { chatId: activeId } = useParams({ strict: false });
	const answered = useNoAccountPromptAnswered(userId);
	const [closed, setClosed] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [failed, setFailed] = useState(false);
	const waiting = noAccountChats(chats);
	// Held while the dialog closes, so its text doesn't change as the chats move or go.
	const [shownCount, setShownCount] = useState(waiting.length);
	const open = !answered && !closed && waiting.length > 0;
	if (open && shownCount !== waiting.length) setShownCount(waiting.length);

	const answer = async (choice: NoAccountChoice) => {
		setFailed(false);
		setClosed(true);
		try {
			if (choice === "delete" && waiting.some((chat) => chat.id === activeId)) {
				await navigate({ to: "/new" });
			}
			await answerNoAccountPrompt(choice, userId);
		} catch (error) {
			logError("Couldn't update the chats from before sign-in:", error);
			setFailed(true);
			setConfirmingDelete(false);
			setClosed(false);
		}
	};
	const close = () => {
		setClosed(true);
		setConfirmingDelete(false);
	};

	const chatsLabel = shownCount === 1 ? "1 chat" : `${shownCount} chats`;
	return (
		<AlertDialog open={open} onOpenChange={(next) => !next && close()}>
			<AlertDialogContent>
				{confirmingDelete ? (
					<>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete {chatsLabel}?</AlertDialogTitle>
							<AlertDialogDescription>
								They'll be deleted from this browser. They aren't saved anywhere
								else, so this can't be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<Button
								variant="outline"
								onClick={() => setConfirmingDelete(false)}
							>
								Cancel
							</Button>
							<Button variant="destructive" onClick={() => answer("delete")}>
								Delete {chatsLabel}
							</Button>
						</AlertDialogFooter>
					</>
				) : (
					<>
						<AlertDialogHeader>
							<AlertDialogTitle>
								You have {chatsLabel} from before you signed in
							</AlertDialogTitle>
							<AlertDialogDescription>
								Chats made signed out are saved in this browser but not to an
								account, so they show for anyone using it, signed in or not.
								Added to your account, they show only while you're signed in.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<p className="text-sm text-muted-foreground">
							Adding them only changes this browser for now. Once sync arrives,
							they'll upload to your account.
						</p>
						{failed && (
							<p role="alert" className="text-sm text-destructive">
								Couldn't update those chats. Try again.
							</p>
						)}
						<AlertDialogFooter>
							<Button
								variant="destructive"
								onClick={() => setConfirmingDelete(true)}
							>
								Delete them
							</Button>
							<Button variant="outline" onClick={() => answer("keep")}>
								Keep them separate
							</Button>
							<Button onClick={() => answer("add")}>Add to your account</Button>
						</AlertDialogFooter>
					</>
				)}
			</AlertDialogContent>
		</AlertDialog>
	);
}
