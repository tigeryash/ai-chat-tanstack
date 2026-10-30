import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChatScreen } from "@/components/chat/chat-screen";
import { currentViewer, useViewer } from "@/lib/account";
import { openChat } from "@/lib/chat/chat-sessions";
import { isOpenChatVisibleTo, retainChat } from "@/lib/chat/open-chats";

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

function RouteComponent() {
	const { chatId } = Route.useParams();
	const navigate = useNavigate();
	const viewer = useViewer();
	// After signing out (or removing the chat), leave instead of showing a chat this viewer can't see.
	const hidden = viewer !== undefined && !isOpenChatVisibleTo(chatId, viewer);
	// Keeps the chat open while it's on screen (open chats are released when idle, quality audit P8).
	useEffect(() => retainChat(chatId), [chatId]);
	useEffect(() => {
		if (hidden) void navigate({ to: "/new", replace: true });
	}, [hidden, navigate]);

	if (hidden) return null;
	return <ChatScreen key={chatId} chat={openChat(chatId)} />;
}
