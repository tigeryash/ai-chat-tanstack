import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChatScreen } from "@/components/chat/chat-screen";
import { useViewer } from "@/lib/account";
import { openNewChat } from "@/lib/chat/chat-sessions";
import { retainChat } from "@/lib/chat/open-chats";

// A new local chat. Nothing is stored (and nothing touches Convex) until its first reply finishes.
// Sending moves to the chat's own URL; the reply keeps streaming, because the open chat outlives
// this page.
export const Route = createFileRoute("/(dashboard)/new")({
	ssr: false,
	component: RouteComponent,
});

function RouteComponent() {
	const viewer = useViewer();
	if (viewer === undefined) return null;
	// The chat belongs to whoever is signed in (roadmap 1.9), so signing in or out here starts a new one.
	return <NewChat key={viewer ?? ""} ownerId={viewer} />;
}

function NewChat({ ownerId }: { ownerId: string | null }) {
	const navigate = useNavigate();
	const [chat] = useState(() => openNewChat({ ownerId }));
	// Keeps the chat open while it's on screen (open chats are released when idle, quality audit P8).
	useEffect(() => retainChat(chat.id), [chat.id]);
	return (
		<ChatScreen
			chat={chat}
			onSend={() => navigate({ to: "/$chatId", params: { chatId: chat.id } })}
		/>
	);
}
