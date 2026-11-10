import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChatView } from "@/components/chat/chat-view";
import { BrowserChatTransport } from "@/lib/chat/browser-transport";
import { openChat, openNewChat, openSavedChat } from "@/lib/chat/chat-sessions";
import { mockChatModel } from "@/lib/chat/mock-model";
import type { ModelSelection } from "@/lib/chat/model-selection";
import { z } from "@/lib/zod";
import { MOCK_REASONING, MOCK_REPLY } from "./-mock-chat";

// The chat view without a session, streaming from the AI SDK mock model (e2e/chat.spec.ts). Uses the
// real transport and chat store; only the model is scripted. `?chat=<id>` reopens a saved chat.

// `?numbered` picks a model whose replies tell apart ("Take 1.", "Take 2.", …), for regenerating.
let takes = 0;
const transport = new BrowserChatTransport(async (selection) => {
	if (selection.model === NUMBERED.model) {
		takes += 1;
		return mockChatModel({ text: ["Take ", `${takes}.`], chunkDelayInMs: 60 });
	}
	return mockChatModel({
		reasoning: MOCK_REASONING,
		text: MOCK_REPLY,
		chunkDelayInMs: 60,
	});
});
const SELECTION: ModelSelection = { provider: "local", model: "mock-model" };
const NUMBERED: ModelSelection = { provider: "local", model: "numbered" };

export const Route = createFileRoute("/e2e/chat")({
	ssr: false,
	validateSearch: z.object({
		chat: z.string().optional(),
		numbered: z.boolean().optional(),
	}),
	component: ChatHarness,
});

function useHarnessChat(savedId: string | undefined) {
	const [chatId, setChatId] = useState<string | null>(null);
	useEffect(() => {
		if (!savedId) {
			setChatId(openNewChat({ transport, ownerId: null }).id);
			return;
		}
		openSavedChat(savedId, null).then((found) =>
			setChatId(found ? savedId : null),
		);
	}, [savedId]);
	return chatId ? openChat(chatId) : null;
}

function ChatHarness() {
	const { chat: savedId, numbered } = Route.useSearch();
	const chat = useHarnessChat(savedId);
	return (
		<main className="h-screen" data-chat-id={chat?.id}>
			{chat && (
				<ChatView chat={chat} selection={numbered ? NUMBERED : SELECTION} />
			)}
		</main>
	);
}
