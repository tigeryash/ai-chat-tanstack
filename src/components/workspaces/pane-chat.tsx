import type { ReactNode } from "react";
import {
	CHAT_FAILED,
	ChatPlaceholder,
	OPENING_CHAT,
} from "@/components/chat/chat-placeholder";
import { currentViewer } from "@/lib/account";
import type { OpenChat } from "@/lib/chat/open-chats";
import { useOpenChat } from "@/lib/chat/use-open-chat";
import { openPaneChat } from "@/lib/workspaces/workspace-sessions";

/**
 * One pane's chat, once it's open. A pane chat this tab has released is read back from the store
 * first (quality audit Q2, W1); a pane that was never sent from opens empty, as when the workspace opens.
 */
export function PaneChat({
	chatId,
	children,
}: {
	chatId: string;
	children: (open: OpenChat) => ReactNode;
}) {
	const state = useOpenChat(chatId, async (id) =>
		openPaneChat({ chatId: id }, await currentViewer()),
	);
	if (state.status === "open") return children(state.open);
	let message = OPENING_CHAT;
	if (state.status === "missing") message = "This chat isn't available.";
	if (state.status === "failed") message = CHAT_FAILED;
	return <ChatPlaceholder>{message}</ChatPlaceholder>;
}
