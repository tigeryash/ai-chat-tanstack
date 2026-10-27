import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChatScreen } from "@/components/chat/chat-screen";
import { openNewChat } from "@/lib/chat/chat-sessions";

// A new local chat. Nothing is stored (and nothing touches Convex) until its first reply finishes.
// Sending moves to the chat's own URL; the reply keeps streaming, because the open chat outlives
// this page.
export const Route = createFileRoute("/(dashboard)/new")({
	ssr: false,
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const [chat] = useState(() => openNewChat());
	return (
		<ChatScreen
			chat={chat}
			onSend={() => navigate({ to: "/$chatId", params: { chatId: chat.id } })}
		/>
	);
}
