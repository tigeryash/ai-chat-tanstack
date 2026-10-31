import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useSyncExternalStore } from "react";

/** A chat's status without `useChat`, so a pane header re-renders on status changes, not per chunk. */
export function useChatStatus(
	chat: Chat<UIMessage>,
): Chat<UIMessage>["status"] {
	const getStatus = () => chat.status;
	return useSyncExternalStore(
		(onChange) => chat["~registerStatusCallback"](onChange),
		getStatus,
		getStatus,
	);
}
