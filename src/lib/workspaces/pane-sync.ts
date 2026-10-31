import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useSyncExternalStore } from "react";
import { logError } from "@/lib/log";

// The synced panes of one workspace (roadmap 3.2, decisions 16 and 18). Each synced pane joins with its
// `Chat` and a `send` that uses its own model and settings. They share one composer draft, a send goes
// to every one of them, and the composer's Stop stops every one that's replying. Panes never see each
// other's history: when their user messages differ, the hub reports them as diverged. Imports nothing
// from the AI SDK at runtime.

export interface SyncedPane {
	chat: Pick<
		Chat<UIMessage>,
		| "status"
		| "messages"
		| "stop"
		| "~registerStatusCallback"
		| "~registerMessagesCallback"
	>;
	/** Sends `text` from this pane, to its own model. */
	send: (text: string) => void;
}

export interface PaneSyncState {
	/** The shared composer draft. */
	draft: string;
	/** Some synced pane is replying. */
	replying: boolean;
	/** Synced panes have different user messages, so their replies aren't like for like. */
	diverged: boolean;
}

export interface PaneSync {
	getState(): PaneSyncState;
	subscribe(listener: () => void): () => void;
	setDraft(draft: string): void;
	/** Joins a pane, until the returned function is called. Joining again replaces its entry. */
	join(paneId: string, pane: SyncedPane): () => void;
	sendAll(text: string): void;
	stopAll(): void;
}

const isBusy = (chat: SyncedPane["chat"]) =>
	chat.status === "submitted" || chat.status === "streaming";

/** What a pane was asked, in order: its user messages' text, which is what syncing keeps equal. */
export function userHistory(messages: readonly UIMessage[]): string {
	return messages
		.filter((message) => message.role === "user")
		.map((message) =>
			message.parts
				.map((part) => (part.type === "text" ? part.text : `[${part.type}]`))
				.join(""),
		)
		.join("\u0000");
}

export function createPaneSync(): PaneSync {
	let state: PaneSyncState = { draft: "", replying: false, diverged: false };
	const panes = new Map<string, { pane: SyncedPane; leave: () => void }>();
	const listeners = new Set<() => void>();

	const update = (changes: Partial<PaneSyncState>) => {
		const next = { ...state, ...changes };
		if (
			next.draft === state.draft &&
			next.replying === state.replying &&
			next.diverged === state.diverged
		) {
			return;
		}
		state = next;
		for (const listener of listeners) listener();
	};
	const recompute = () => {
		const chats = [...panes.values()].map(({ pane }) => pane.chat);
		update({
			replying: chats.some(isBusy),
			diverged:
				new Set(chats.map((chat) => userHistory(chat.messages))).size > 1,
		});
	};

	return {
		getState: () => state,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		setDraft: (draft) => update({ draft }),
		join(paneId, pane) {
			panes.get(paneId)?.leave();
			const offStatus = pane.chat["~registerStatusCallback"](recompute);
			const offMessages = pane.chat["~registerMessagesCallback"](recompute);
			const entry = {
				pane,
				leave: () => {
					offStatus();
					offMessages();
				},
			};
			panes.set(paneId, entry);
			recompute();
			return () => {
				if (panes.get(paneId) !== entry) return;
				entry.leave();
				panes.delete(paneId);
				recompute();
			};
		},
		sendAll(text) {
			for (const { pane } of panes.values()) pane.send(text);
		},
		stopAll() {
			for (const { pane } of panes.values()) {
				if (!isBusy(pane.chat)) continue;
				pane.chat
					.stop()
					.catch((error) => logError("Couldn't stop the reply:", error));
			}
		},
	};
}

export function usePaneSyncState(sync: PaneSync): PaneSyncState {
	return useSyncExternalStore(sync.subscribe, sync.getState, sync.getState);
}
