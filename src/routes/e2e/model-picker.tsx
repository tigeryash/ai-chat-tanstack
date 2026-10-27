import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChatScreen } from "@/components/chat/chat-screen";
import { BrowserChatTransport } from "@/lib/chat/browser-transport";
import { openChat } from "@/lib/chat/chat-sessions";
import { mockChatModel } from "@/lib/chat/mock-model";
import { z } from "@/lib/zod";

// The real chat screen (picker, model card, removed-model banner) against the e2e stub's seeded catalog
// (e2e/model-picker.spec.ts). Only the model is scripted: it says where the request was routed, so
// tests can check the picker's choice reached the transport. `?chat=<id>` sets the (new) chat's id.

const transport = new BrowserChatTransport(async ({ provider, model }) =>
	mockChatModel({
		text: ["Mock reply ", `from ${model} `, `via ${provider}.`],
	}),
);

export const Route = createFileRoute("/e2e/model-picker")({
	ssr: false,
	validateSearch: z.object({ chat: z.string().max(100).optional() }),
	component: ModelPickerHarness,
});

function ModelPickerHarness() {
	const { chat: chatId } = Route.useSearch();
	const [fallbackId] = useState(() => crypto.randomUUID());
	const chat = openChat(chatId ?? fallbackId, { transport });
	return (
		<main className="h-screen" data-chat-id={chat.id}>
			<ChatScreen chat={chat} />
		</main>
	);
}
