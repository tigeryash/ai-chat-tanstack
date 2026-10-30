import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useRef, useSyncExternalStore } from "react";

/**
 * One value derived from a chat's messages, re-rendering only when that value changes (by `isEqual`),
 * not on every streamed chunk like `useChat`. For things above the message list (the model picker's
 * inputs) that care about what was sent, not what is streaming in.
 */
export function useChatMessagesValue<T>(
	chat: Chat<UIMessage>,
	select: (messages: readonly UIMessage[]) => T,
	isEqual: (a: T, b: T) => boolean = Object.is,
): T {
	// The last value handed out, so an equal one keeps its identity (useSyncExternalStore compares with
	// Object.is and would loop on a fresh object every call).
	const cache = useRef<{ chat: Chat<UIMessage>; value: T } | null>(null);
	const getSnapshot = () => {
		const next = select(chat.messages);
		const cached = cache.current;
		if (cached && cached.chat === chat && isEqual(cached.value, next)) {
			return cached.value;
		}
		cache.current = { chat, value: next };
		return next;
	};
	return useSyncExternalStore(
		(onChange) => chat["~registerMessagesCallback"](onChange),
		getSnapshot,
		getSnapshot,
	);
}
