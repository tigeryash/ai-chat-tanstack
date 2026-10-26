import { createFileRoute } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { useEffect, useState } from "react";
import MessagesList from "@/components/chat/chatstuff/messages-list";

export const Route = createFileRoute("/e2e/messages")({
	component: MessagesHarness,
});

// Mirrored in e2e/messages.spec.ts.
const USER_MESSAGES = {
	short: "Test",
	sentence: "wait still testing stuff",
	longWord: "hiiiiiiiiiiiiiiiiiiii",
	multiline: "first line\nsecond line\n\n  indented after a blank line",
	markdownLike: "# not a heading and **not bold**",
	paragraph: "A long message that has to wrap. ".repeat(12).trim(),
} as const;

const userMessage = (key: keyof typeof USER_MESSAGES): UIMessage => ({
	id: `user-${key}`,
	role: "user",
	parts: [{ type: "text", text: USER_MESSAGES[key] }],
});

const MESSAGES: UIMessage[] = [
	userMessage("short"),
	{
		id: "assistant-1",
		role: "assistant",
		parts: [
			{ type: "step-start" },
			{ type: "reasoning", text: "Short reply.", state: "done" },
			{ type: "text", text: "Hi! **Markdown** still renders in replies." },
		],
	},
	userMessage("sentence"),
	userMessage("longWord"),
	userMessage("multiline"),
	userMessage("markdownLike"),
	userMessage("paragraph"),
];

// A chat transcript without a session, for checking how messages lay out. `data-hydrated` tells tests
// when the client has taken over.
function MessagesHarness() {
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		setHydrated(true);
	}, []);

	return (
		<main data-hydrated={hydrated} className="flex h-screen flex-col">
			<MessagesList messages={MESSAGES} />
		</main>
	);
}
