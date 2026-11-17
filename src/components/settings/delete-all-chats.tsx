import { useNavigate, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useViewer } from "@/lib/account";
import { logError } from "@/lib/log";
import { withSettings } from "@/lib/settings/navigation";
import type { SettingControlProps } from "./setting-row-props";

type Message = { error: boolean; text: string } | null;

const localData = () => import("@/lib/storage/local-data");

// Pages that show a saved chat. Read from the router's state, not `useMatchRoute`, which would add a
// router chunk to every page's first load (bundle budget).
const CHAT_PAGES: ReadonlySet<string> = new Set([
	"/(dashboard)/$chatId",
	"/(dashboard)/w/$workspaceId",
]);

/** Settings → Your data → Danger zone (Refine S11): deletes every chat the viewer can see here. */
export function DeleteAllChats({
	controlId,
	descriptionId,
}: SettingControlProps) {
	const viewer = useViewer();
	const navigate = useNavigate();
	const router = useRouter();
	const [confirming, setConfirming] = useState(false);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<Message>(null);

	const deleteAll = async () => {
		if (viewer === undefined) return;
		setConfirming(false);
		setBusy(true);
		setMessage(null);
		try {
			// Leave a chat or workspace page first, like the sidebar does, so it can't save the chat again.
			const onChatPage = router.state.matches.some((match) =>
				CHAT_PAGES.has(match.routeId),
			);
			if (onChatPage) {
				await navigate({
					to: "/new",
					search: (prev) => withSettings(prev, "data"),
					replace: true,
					resetScroll: false,
				});
			}
			const { deleteAllLocalChats } = await localData();
			const deleted = await deleteAllLocalChats(viewer);
			setMessage({
				error: false,
				text:
					deleted === 1
						? "Deleted 1 chat from this browser."
						: `Deleted ${deleted.toLocaleString("en")} chats from this browser.`,
			});
		} catch (error) {
			logError("Couldn't delete all chats:", error);
			setMessage({
				error: true,
				text: "Couldn't delete your chats. Some may be left; try again.",
			});
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<Button
				id={controlId}
				aria-describedby={descriptionId}
				size="sm"
				variant="destructive"
				disabled={busy || viewer === undefined}
				onClick={() => setConfirming(true)}
				className="@lg:justify-self-end"
			>
				{busy && <Loader2 aria-hidden className="animate-spin" />}
				{busy ? "Deleting…" : "Delete all chats"}
			</Button>
			{message && (
				<p
					role={message.error ? "alert" : "status"}
					className={
						message.error
							? "col-span-full text-destructive text-sm"
							: "col-span-full text-muted-foreground text-sm"
					}
				>
					{message.text}
				</p>
			)}
			<AlertDialog open={confirming} onOpenChange={setConfirming}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete all chats on this device?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Every chat you can see here, with its branches, attached files and
							workspaces, will be deleted from this browser. Saved prompts, keys
							and settings stay. This can't be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => void deleteAll()}
						>
							Delete all chats
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
