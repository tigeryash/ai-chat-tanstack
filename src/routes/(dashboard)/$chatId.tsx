import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChatScreen } from "@/components/chat/chat-screen";
import { currentViewer, useViewer } from "@/lib/account";
import {
	isOpenChatVisibleTo,
	openChat,
	openSavedChat,
} from "@/lib/chat/chat-sessions";

// A chat stored in this browser (roadmap 1.2/1.3). Rendered in the browser only (decision 12): the
// messages live in IndexedDB, and replies stream from the provider straight to this page.
// Another account's chat is treated as missing (roadmap 1.9).
export const Route = createFileRoute("/(dashboard)/$chatId")({
	ssr: false,
	loader: async ({ params }) => {
		const viewer = await currentViewer();
		if (!(await openSavedChat(params.chatId, viewer))) throw notFound();
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { chatId } = Route.useParams();
	const navigate = useNavigate();
	const viewer = useViewer();
	// After signing out (or removing the chat), leave instead of showing a chat this viewer can't see.
	const hidden = viewer !== undefined && !isOpenChatVisibleTo(chatId, viewer);
	useEffect(() => {
		if (hidden) void navigate({ to: "/new", replace: true });
	}, [hidden, navigate]);

	if (hidden) return null;
	return <ChatScreen key={chatId} chat={openChat(chatId)} />;
}
