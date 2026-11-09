import type { Chat } from "@ai-sdk/react";
import type { FileUIPart, UIMessage } from "ai";
import { useSyncExternalStore } from "react";
import {
	type AttachedFileInfo,
	planPaneSend,
} from "@/lib/attachments/capability";
import type { AttachmentSupport } from "@/lib/attachments/validate";
import { logError } from "@/lib/log";

// The synced panes of one workspace (roadmap 3.2, decisions 16 and 18). Each synced pane joins with its
// `Chat` and a `send` that uses its own model and settings. They share one composer draft, a send goes
// to every one of them, and the composer's Stop stops every one that's replying. Panes never see each
// other's history: when their user messages differ, the hub reports them as diverged. Attachments are
// checked per pane (roadmap 3.3, decision 17): the hub knows what's attached in the synced composers, so
// a pane whose model can't read a file says so before the send, and each pane gets only the files its
// model reads, or nothing if its person chose to skip it. Imports nothing from the AI SDK at runtime.

export interface SyncedPane {
	chat: Pick<
		Chat<UIMessage>,
		| "status"
		| "messages"
		| "stop"
		| "~registerStatusCallback"
		| "~registerMessagesCallback"
	>;
	/** Sends `text` (and any attachments, roadmap 1.6) from this pane, to its own model. */
	send: (text: string, files?: FileUIPart[]) => void;
	/** What this pane's model reads now. Absent or undefined: unknown, so the provider decides. */
	support?: () => AttachmentSupport | undefined;
}

export interface PaneSyncState {
	/** The shared composer draft. */
	draft: string;
	/** Some synced pane is replying. */
	replying: boolean;
	/** Synced panes have different user messages, so their replies aren't like for like. */
	diverged: boolean;
	/** What's attached in the synced composers, waiting to be sent. */
	attachments: readonly AttachedFileInfo[];
	/** Panes whose person chose to skip them while a file their model can't read is attached. */
	skipped: readonly string[];
}

export interface PaneSync {
	getState(): PaneSyncState;
	subscribe(listener: () => void): () => void;
	setDraft(draft: string): void;
	/** What one pane's composer has attached (names and types only); [] once it sends or clears. */
	setAttachments(composerId: string, files: readonly AttachedFileInfo[]): void;
	/** A pane's choice for files its model can't read: skip the pane (true) or send text only. */
	setSkipped(paneId: string, skip: boolean): void;
	/** Joins a pane, until the returned function is called. Joining again replaces its entry. */
	join(paneId: string, pane: SyncedPane): () => void;
	sendAll(text: string, files?: FileUIPart[]): void;
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
	let state: PaneSyncState = {
		draft: "",
		replying: false,
		diverged: false,
		attachments: [],
		skipped: [],
	};
	const panes = new Map<string, { pane: SyncedPane; leave: () => void }>();
	const attached = new Map<string, readonly AttachedFileInfo[]>();
	const listeners = new Set<() => void>();

	const update = (changes: Partial<PaneSyncState>) => {
		const next = { ...state, ...changes };
		const keys = Object.keys(next) as (keyof PaneSyncState)[];
		if (keys.every((key) => next[key] === state[key])) return;
		state = next;
		for (const listener of listeners) listener();
	};
	const recomputeAttachments = () => {
		const attachments = [...attached.values()].flat();
		update({
			attachments,
			// Nothing attached, nothing to skip for: the next attachment asks afresh.
			skipped: attachments.length === 0 ? [] : state.skipped,
		});
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
		setAttachments(composerId, files) {
			const before = attached.get(composerId) ?? [];
			const same =
				before.length === files.length &&
				before.every(
					(file, index) =>
						file.name === files[index]?.name &&
						file.mediaType === files[index]?.mediaType,
				);
			if (same) return;
			if (files.length === 0) attached.delete(composerId);
			else attached.set(composerId, [...files]);
			recomputeAttachments();
		},
		setSkipped(paneId, skip) {
			if (state.skipped.includes(paneId) === skip) return;
			update({
				skipped: skip
					? [...state.skipped, paneId]
					: state.skipped.filter((id) => id !== paneId),
			});
		},
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
				attached.delete(paneId);
				update({ skipped: state.skipped.filter((id) => id !== paneId) });
				recomputeAttachments();
				recompute();
			};
		},
		sendAll(text, files) {
			for (const [paneId, { pane }] of panes) {
				const plan = planPaneSend(text, files ?? [], {
					support: pane.support?.(),
					skip: state.skipped.includes(paneId),
				});
				if (plan.send) pane.send(text, files && plan.files);
			}
			update({ skipped: [] });
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
