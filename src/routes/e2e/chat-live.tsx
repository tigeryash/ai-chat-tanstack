import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChatScreen } from "@/components/chat/chat-screen";
import { openNewChat } from "@/lib/chat/chat-sessions";

// The real chat screen (picker, transport, providers) without a session, for e2e/chat-keys.spec.ts.
// Tests fake the provider's API, so nothing leaves the machine.
export const Route = createFileRoute("/e2e/chat-live")({
	ssr: false,
	component: LiveChatHarness,
});

function LiveChatHarness() {
	const [chat] = useState(() => openNewChat({ ownerId: null }));
	return (
		<main className="h-screen" data-chat-id={chat.id}>
			<ChatScreen chat={chat} />
		</main>
	);
}
