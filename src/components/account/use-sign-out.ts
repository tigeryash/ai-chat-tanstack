import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { removeAccountChats } from "@/lib/chat/chat-ownership";
import { isOpenChatVisibleTo } from "@/lib/chat/open-chats";
import { logError } from "@/lib/log";

// Signing out (roadmap 1.9), shared by the sidebar and Settings → Account. A plain sign-out hides the
// account's chats: they stay in this browser and come back at its next sign-in here. With
// `removeChats`, they're deleted from this browser first. Chats made signed out are left alone either way.

export function useSignOut(userId: string) {
	const router = useRouter();
	const navigate = useNavigate();
	const { chatId: activeId } = useParams({ strict: false });
	const [failed, setFailed] = useState(false);

	const signOut = async (removeChats: boolean) => {
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

	return { signOut, failed };
}
