import {
	useEffect,
	useEffectEvent,
	useState,
	useSyncExternalStore,
} from "react";
import { logError } from "@/lib/log";
import { type OpenChat, peekOpenChat, subscribeOpenChats } from "./open-chats";

/** "missing": `reopen` found no such chat for this viewer. "failed": reading it threw. */
export type OpenChatState =
	| { status: "open"; open: OpenChat }
	| { status: "opening" }
	| { status: "missing" }
	| { status: "failed" };

/**
 * The open chat with this id, for a route or pane that shows a saved chat. Nothing creates a chat while
 * rendering (quality audit Q2, W1): an empty `Chat` under a saved id would save over its history with
 * the next reply. When this tab has released the chat (`open-chats.ts` keeps 8 idle ones), `reopen`
 * reads it back from the store, resolving false when it's gone, and the state is "opening" meanwhile.
 */
export function useOpenChat(
	id: string,
	reopen: (id: string) => Promise<boolean>,
): OpenChatState {
	const open = useSyncExternalStore(subscribeOpenChats, () => peekOpenChat(id));
	const [outcome, setOutcome] = useState<{
		id: string;
		status: "missing" | "failed";
	}>();
	// An effect event, so a new `reopen` each render doesn't start another read.
	const reopenChat = useEffectEvent(reopen);
	const released = open === undefined;
	useEffect(() => {
		if (!released) return;
		let current = true;
		reopenChat(id).then(
			(found) => {
				if (current && !found) setOutcome({ id, status: "missing" });
			},
			(error: unknown) => {
				logError("Couldn't open the chat:", error);
				if (current) setOutcome({ id, status: "failed" });
			},
		);
		return () => {
			current = false;
		};
	}, [id, released]);

	if (open) return { status: "open", open };
	if (outcome?.id === id) return { status: outcome.status };
	return { status: "opening" };
}
