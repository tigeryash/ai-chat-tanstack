import { createFileRoute, notFound } from "@tanstack/react-router";
import { ChatScreen } from "@/components/chat/chat-screen";
import { openChat, openSavedChat } from "@/lib/chat/chat-sessions";

// A chat stored in this browser (roadmap 1.2/1.3). Rendered in the browser only (decision 12): the
// messages live in IndexedDB, and replies stream from the provider straight to this page.
export const Route = createFileRoute("/(dashboard)/$chatId")({
	ssr: false,
	loader: async ({ params }) => {
		if (!(await openSavedChat(params.chatId))) throw notFound();
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { chatId } = Route.useParams();
	return <ChatScreen key={chatId} chat={openChat(chatId)} />;
}
