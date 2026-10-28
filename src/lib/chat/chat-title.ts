import type { UIMessage } from "ai";

// Roadmap 1.4: a chat is named after the first line of its first message until the person renames
// it. Naming with a "utility model" is a later follow-up.

export const TITLE_MAX_LENGTH = 80;

/** The first non-empty line of the first user message's text, or "" if it has none. */
export function titleFromMessages(messages: readonly UIMessage[]): string {
	const first = messages.find((message) => message.role === "user");
	const text = (first?.parts ?? [])
		.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("\n");
	const line = text
		.split("\n")
		.map((candidate) => candidate.trim())
		.find((candidate) => candidate.length > 0);
	if (!line) return "";
	return line.length > TITLE_MAX_LENGTH
		? `${line.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`
		: line;
}

/** What the sidebar shows for a chat with no title. */
export const UNTITLED_CHAT = "New chat";
