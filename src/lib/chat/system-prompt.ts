import { useSyncExternalStore } from "react";
import { logError } from "@/lib/log";
import type { ChatStore } from "@/lib/storage/chat-store";

// The shared system prompt (decision 19: a chat's own prompt, else the shared one; the prompt library
// is roadmap 3.6). It's content, so it lives in IndexedDB with the chats, not in localStorage. Loaded
// once per tab and cached here so every chat can read it synchronously when it sends.

let current = "";
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();

function notify() {
	for (const listener of listeners) listener();
}

/** Starts loading the shared prompt from `store`, once per tab. */
export function loadDefaultSystemPrompt(store: ChatStore): Promise<void> {
	loading ??= store
		.getDefaultSystemPrompt()
		.then((prompt) => {
			current = prompt;
			notify();
		})
		.catch((error) =>
			logError("Couldn't read the default system prompt:", error),
		);
	return loading;
}

export async function saveDefaultSystemPrompt(
	prompt: string,
	store: ChatStore,
): Promise<void> {
	current = prompt;
	notify();
	try {
		await store.setDefaultSystemPrompt(prompt);
	} catch (error) {
		logError("Couldn't save the default system prompt:", error);
	}
}

/** The shared prompt ("" when none), loading it on first use. */
export function useDefaultSystemPrompt(store: ChatStore): string {
	void loadDefaultSystemPrompt(store);
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		() => current,
		() => current,
	);
}

/** What a chat sends as its system prompt: its own, else the shared one. Empty means none. */
export function systemPromptFor(
	own: string | undefined,
	shared: string,
): string {
	return own ?? shared;
}
