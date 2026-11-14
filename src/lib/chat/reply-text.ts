import type { UIMessage } from "ai";

// A reply as text (roadmap R2 S7): its text parts only, never reasoning, files or tool output. The
// reply's Copy button and the palette's "Copy last reply" both use it.

export function replyText(message: Pick<UIMessage, "parts">): string {
	return message.parts
		.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("\n\n");
}

/** The chat's last message when it's a reply, else undefined (nothing to copy or regenerate). */
export function lastReply(
	messages: readonly UIMessage[],
): UIMessage | undefined {
	const last = messages.at(-1);
	return last?.role === "assistant" ? last : undefined;
}
