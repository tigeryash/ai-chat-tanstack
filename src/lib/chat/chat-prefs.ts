import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";

// Settings → Chat (roadmap R2 S4), kept in this browser. Only switches about how a chat looks; never
// chat content.

export const CHAT_PREFS_KEY = "highelo-chat-prefs";

const schema = z.object({
	/** A notice in the pane header when the chat nears or passes its context length. */
	contextWarnings: z.boolean(),
});

export type ChatPrefs = z.infer<typeof schema>;

const DEFAULT_CHAT_PREFS: ChatPrefs = { contextWarnings: true };

const chatPrefs = createLocalStore(CHAT_PREFS_KEY, schema, DEFAULT_CHAT_PREFS);

export function updateChatPrefs(change: Partial<ChatPrefs>): void {
	chatPrefs.write({ ...chatPrefs.read(), ...change });
}

/** Wrapped in a `use…` function so React (and its compiler) treat the read as a hook. */
export function useChatPrefs(): ChatPrefs {
	return chatPrefs.use();
}
