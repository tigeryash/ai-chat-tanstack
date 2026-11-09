import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChatScreen } from "@/components/chat/chat-screen";
import { AddPaneButton } from "@/components/workspaces/add-pane-button";
import { LayoutsMenu } from "@/components/workspaces/layouts-menu";
import { setChatModelChoice } from "@/lib/chat/chat-model-choice";
import { openNewChat } from "@/lib/chat/chat-sessions";
import type { ModelChoice } from "@/lib/chat/model-selection";
import { retainChat } from "@/lib/chat/open-chats";

// A new local chat (`/new`). Nothing is stored (and nothing touches Convex) until its first reply
// finishes. Sending moves to the chat's own URL; the reply keeps streaming, because the open chat
// outlives this page. A deep link (roadmap 3.5) can start it on a model, and say what it couldn't open.

export function NewChat({
	ownerId,
	model,
	notice,
}: {
	ownerId: string | null;
	/** The model a deep link named; it doesn't become the default for new chats. */
	model?: ModelChoice;
	notice?: string;
}) {
	const navigate = useNavigate();
	const [chat] = useState(() => {
		const opened = openNewChat({ ownerId });
		if (model) setChatModelChoice(opened.id, model);
		return opened;
	});
	// Keeps the chat open while it's on screen (open chats are released when idle, quality audit P8).
	useEffect(() => retainChat(chat.id), [chat.id]);
	return (
		<ChatScreen
			chat={chat}
			onSend={() => navigate({ to: "/$chatId", params: { chatId: chat.id } })}
			actions={
				<>
					{notice && (
						<span role="status" className="text-muted-foreground text-xs">
							{notice}
						</span>
					)}
					<LayoutsMenu />
					<AddPaneButton chatId={chat.id} />
				</>
			}
		/>
	);
}
