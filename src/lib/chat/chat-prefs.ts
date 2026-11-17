import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";

// Settings → Chat (roadmap R2 S4 and S10), kept in this browser. Only choices about how a chat looks
// and how panes start; never chat content. Each field has its own default, so a value saved before a
// field existed keeps its other choices.

export const CHAT_PREFS_KEY = "highelo-chat-prefs";

/**
 * Where a reply's stats show: only in its "⋯" menu (stored as `none`), or also beside the reply: just the
 * cost, or cost, tokens and timings. The "⋯" menu always lists them all.
 */
export const INLINE_STATS = ["none", "cost", "all"] as const;
export type InlineStats = (typeof INLINE_STATS)[number];

/**
 * How a reply's reasoning starts: closed until the person opens it (its "Thinking..." line still shows
 * while it streams), open while the model thinks and closed once it's done, or always open. Add a
 * choice here, with its label in `chat-settings.tsx` and its props in `message-ui.tsx`.
 */
export const REASONING_STARTS = ["closed", "while-thinking", "open"] as const;
export type ReasoningStart = (typeof REASONING_STARTS)[number];

const schema = z.object({
	/** A notice in the pane header when the chat nears or passes its context length. */
	contextWarnings: z.boolean().default(true),
	inlineStats: z.enum(INLINE_STATS).default("none"),
	reasoning: z.enum(REASONING_STARTS).default("closed"),
	/** Whether a workspace opens with Sync scroll on (roadmap 3.4). */
	syncScroll: z.boolean().default(false),
	/** Whether a pane added to a workspace, or a new workspace's panes, start synced (roadmap 3.2). */
	newPanesSynced: z.boolean().default(true),
});

export type ChatPrefs = z.infer<typeof schema>;

export const DEFAULT_CHAT_PREFS: ChatPrefs = {
	contextWarnings: true,
	inlineStats: "none",
	reasoning: "closed",
	syncScroll: false,
	newPanesSynced: true,
};

const chatPrefs = createLocalStore(CHAT_PREFS_KEY, schema, DEFAULT_CHAT_PREFS);

export function updateChatPrefs(change: Partial<ChatPrefs>): void {
	chatPrefs.write({ ...chatPrefs.read(), ...change });
}

/** The current prefs, outside React (a new workspace's panes, a new pane). */
export function readChatPrefs(): ChatPrefs {
	return chatPrefs.read();
}

/** Wrapped in a `use…` function so React (and its compiler) treat the read as a hook. */
export function useChatPrefs(): ChatPrefs {
	return chatPrefs.use();
}
