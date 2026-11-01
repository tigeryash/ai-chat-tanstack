import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
	CHAT_FAILED,
	ChatPlaceholder,
	OPENING_CHAT,
} from "@/components/chat/chat-placeholder";
import { ChatScreen } from "@/components/chat/chat-screen";
import { AddPaneButton } from "@/components/workspaces/add-pane-button";
import { currentViewer, useViewer } from "@/lib/account";
import { openSavedChat } from "@/lib/chat/chat-sessions";
import { retainChat } from "@/lib/chat/open-chats";
import { useOpenChat } from "@/lib/chat/use-open-chat";
import { isVisibleTo } from "@/lib/storage/ownership";

// A chat stored in this browser (roadmap 1.2/1.3). Rendered in the browser only (decision 12): the
// messages live in IndexedDB, and replies stream from the provider straight to this page.
// Another account's chat is treated as missing (roadmap 1.9).
// Route loaders aren't code-split, so the loader imports the chat engine with `import()`: a static
// import would load it on every page (quality audit P1).
export const Route = createFileRoute("/(dashboard)/$chatId")({
	ssr: false,
	loader: async ({ params }) => {
		const [viewer, { openSavedChat }] = await Promise.all([
			currentViewer(),
			import("@/lib/chat/chat-sessions"),
		]);
		if (!(await openSavedChat(params.chatId, viewer))) throw notFound();
	},
	component: RouteComponent,
});

/** Reads a chat this tab has released back from the store (quality audit Q2, W1). */
async function reopenChat(id: string): Promise<boolean> {
	return openSavedChat(id, await currentViewer());
}

function RouteComponent() {
	const { chatId } = Route.useParams();
	const navigate = useNavigate();
	const viewer = useViewer();
	const state = useOpenChat(chatId, reopenChat);
	const open = state.status === "open" ? state.open : undefined;
	// After signing out (or removing the chat), leave instead of showing a chat this viewer can't see.
	const hidden =
		state.status === "missing" ||
		(viewer !== undefined && open !== undefined && !isVisibleTo(open, viewer));
	// Keeps the chat open while it's on screen (open chats are released when idle, quality audit P8).
	useEffect(() => retainChat(chatId), [chatId]);
	useEffect(() => {
		if (hidden) void navigate({ to: "/new", replace: true });
	}, [hidden, navigate]);

	if (hidden) return null;
	if (!open) {
		return (
			<ChatPlaceholder>
				{state.status === "failed" ? CHAT_FAILED : OPENING_CHAT}
			</ChatPlaceholder>
		);
	}
	return (
		<ChatScreen
			key={chatId}
			chat={open.chat}
			actions={
				<AddPaneButton
					chatId={chatId}
					ownerId={open.ownerId ?? viewer ?? null}
				/>
			}
		/>
	);
}
