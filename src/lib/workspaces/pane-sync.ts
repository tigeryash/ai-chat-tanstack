import type { Chat } from "@ai-sdk/react";
import type { FileUIPart, UIMessage } from "ai";
import { useSyncExternalStore } from "react";
import {
	type AttachmentList,
	createAttachmentList,
} from "@/lib/attachments/attachment-list";
import {
	type AttachedFileInfo,
	planPaneSend,
	unreadableFiles,
} from "@/lib/attachments/capability";
import type { AttachmentSupport } from "@/lib/attachments/validate";
import { logError } from "@/lib/log";

// The synced panes of one workspace (roadmap 3.2, decisions 16 and 18). Each synced pane joins with its
// `Chat` and a `send` that uses its own model and settings. They share one composer draft, a send goes
// to every one of them, and the composer's Stop stops every one that's replying. Panes never see each
// other's history: when their user messages differ, the hub reports them as diverged. Attachments are
// shared and checked per pane (roadmap 3.3, decision 17): synced composers all show one attachment list
// (`attachments`), so a send from any of them sends and clears the same files; a pane whose model can't
// read one says so before the send, and each pane gets only the files its model reads, or nothing if its
// person chose to skip it. Imports nothing from the AI SDK at runtime.

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
	/** What's attached in the synced composers (names and types), waiting to be sent. */
	attachments: readonly AttachedFileInfo[];
	/** Panes whose person chose to skip them while a file their model can't read is attached. */
	skipped: readonly string[];
	/** Panes whose model can't read an attached file, so their tabs can say so (roadmap 3.8). */
	warned: readonly string[];
}

export interface PaneSync {
	getState(): PaneSyncState;
	subscribe(listener: () => void): () => void;
	setDraft(draft: string): void;
	/** The synced composers' one attachment list. */
	attachments: AttachmentList;
	/** A pane's choice for files its model can't read: skip the pane (true) or send text only. */
	setSkipped(paneId: string, skip: boolean): void;
	/** A pane's own check (its model against what's attached); returns an undo for when it stops checking. */
	setWarned(paneId: string, warned: boolean): () => void;
	/** Joins a pane, until the returned function is called. Joining again replaces its entry. */
	join(paneId: string, pane: SyncedPane): () => void;
	sendAll(text: string, files?: FileUIPart[]): void;
	stopAll(): void;
	/** Lets go of the attachments (and their previews): the workspace is gone. */
	dispose(): void;
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

export function createPaneSync(
	attachments: AttachmentList = createAttachmentList(),
): PaneSync {
	let state: PaneSyncState = {
		draft: "",
		replying: false,
		diverged: false,
		attachments: [],
		skipped: [],
		warned: [],
	};
	const panes = new Map<string, { pane: SyncedPane; leave: () => void }>();
	const listeners = new Set<() => void>();

	const update = (changes: Partial<PaneSyncState>) => {
		const next = { ...state, ...changes };
		const keys = Object.keys(next) as (keyof PaneSyncState)[];
		if (keys.every((key) => next[key] === state[key])) return;
		state = next;
		for (const listener of listeners) listener();
	};
	// Only a change in names or types reaches the panes, not each file finishing its read.
	const sameFiles = (
		a: readonly AttachedFileInfo[],
		b: readonly AttachedFileInfo[],
	) =>
		a.length === b.length &&
		a.every(
			(file, index) =>
				file.name === b[index]?.name && file.mediaType === b[index]?.mediaType,
		);
	attachments.subscribe(() => {
		const files = attachments.getFiles().map((f) => ({
			name: f.file.name,
			mediaType: f.file.type || f.type,
		}));
		update({
			attachments: sameFiles(files, state.attachments)
				? state.attachments
				: files,
			// Nothing attached, nothing to skip for: the next attachment asks afresh.
			skipped: files.length === 0 ? [] : state.skipped,
		});
	});
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
		attachments,
		setWarned(paneId, warned) {
			const set = (on: boolean) => {
				if (state.warned.includes(paneId) === on) return;
				update({
					warned: on
						? [...state.warned, paneId]
						: state.warned.filter((id) => id !== paneId),
				});
			};
			set(warned);
			return () => set(false);
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
				update({ skipped: state.skipped.filter((id) => id !== paneId) });
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
		dispose: () => attachments.clear(),
	};
}

export function usePaneSyncState(sync: PaneSync): PaneSyncState {
	return useSyncExternalStore(sync.subscribe, sync.getState, sync.getState);
}

const noHub = () => () => {};
const nothing = () => false;

/**
 * Whether the synced composers hold a file this pane's model can't read (roadmap 3.3). A boolean, so a
 * pane re-renders when that flips, not with every keystroke in the shared draft. False without a hub.
 */
export function useCantReadAttachments(
	sync: PaneSync | undefined,
	support: AttachmentSupport | undefined,
): boolean {
	return useSyncExternalStore(
		sync?.subscribe ?? noHub,
		sync
			? () => unreadableFiles(sync.getState().attachments, support).length > 0
			: nothing,
		nothing,
	);
}
