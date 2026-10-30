import type { ChatStore } from "./chat-store";
import { createDexieChatStore } from "./dexie-chat-store";

// The app's one chat store. Its own module, so the sidebar and sign-in code can read chats without
// loading the chat engine (quality audit P1).

let defaultStore: ChatStore | undefined;

/** The app's one chat store. Browser only: chat routes don't render on the server. */
export function chatStore(): ChatStore {
	defaultStore ??= createDexieChatStore();
	return defaultStore;
}
