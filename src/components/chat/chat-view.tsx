import { type Chat, useChat } from "@ai-sdk/react";
import type { FileUIPart, UIMessage } from "ai";
import { type ReactNode, useEffect, useRef, useState } from "react";
import MessagesList from "@/components/chat/chatstuff/messages-list";
import { Input } from "@/components/chat/input";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/track";
import type { AttachmentSupport } from "@/lib/attachments/validate";
import { editMessage, switchBranch } from "@/lib/chat/branching";
import { useChatBranches } from "@/lib/chat/chat-branches";
import {
	LOCAL_PROVIDER,
	type ModelSelection,
} from "@/lib/chat/model-selection";
import { logError } from "@/lib/log";
import type { RequestSettings } from "@/lib/params/request";
import { type PaneSync, usePaneSyncState } from "@/lib/workspaces/pane-sync";

export interface ChatViewProps {
	chat: Chat<UIMessage>;
	/** Where requests go. Sending is off until there is one. */
	selection: ModelSelection | undefined;
	/** The settings panel's values and system prompt (roadmap 2.4b), sent with each request. */
	settings?: RequestSettings;
	header?: ReactNode;
	/** What an empty chat shows (the model card). */
	empty?: ReactNode;
	/** Called right after a message is sent (`/new` moves to the chat's own URL). */
	onSend?: () => void;
	/** In a workspace (roadmap 3.2): its sync hub, and whether this pane is synced. */
	sync?: { hub: PaneSync; synced: boolean };
	/** How many panes the chat is shown with (for `chat_sent`). */
	paneCount?: number;
	/** What the model reads (roadmap 1.6). Absent: unknown, so any accepted file can be attached. */
	attachmentSupport?: AttachmentSupport;
}

/** At most one render per 50 ms while a reply streams; status changes still land at once. */
const STREAM_THROTTLE_MS = 50;

const logFailure = (error: unknown) =>
	logError("Chat request failed:", error instanceof Error ? error.name : error);

/**
 * One chat: its messages, streaming live, and the composer with Stop. Drawn as a pane card (direction
 * A with B's rounded cards, roadmap 3.0b), so 3.1 can lay several side by side.
 */
export function ChatView({
	chat,
	selection,
	settings,
	header,
	empty,
	onSend,
	sync,
	paneCount = 1,
	attachmentSupport,
}: ChatViewProps) {
	const { messages, sendMessage, regenerate, stop, status, error } = useChat({
		chat,
		throttle: STREAM_THROTTLE_MS,
	});
	const busy = status === "submitted" || status === "streaming";
	const options = selection && { body: { ...selection, settings } };
	// Why attached files were refused (roadmap 1.6). Shown above the composer, not in it (hard rule 8).
	const [attachmentErrors, setAttachmentErrors] = useState<string[]>([]);

	const trackSent = (provider: string, hasAttachment = false) =>
		track("chat_sent", {
			providerKind: provider === LOCAL_PROVIDER ? "local" : "hosted",
			paneCount,
			hasAttachment,
		});
	const send = (text: string, files: FileUIPart[] = []) => {
		if (!options) return;
		setAttachmentErrors([]);
		// Not awaited: it resolves when the reply finishes, and the composer clears once this returns.
		sendMessage({ text, files }, options).catch(logFailure);
		trackSent(options.body.provider, files.length > 0);
		onSend?.();
	};
	// A synced pane joins its workspace's hub, which calls the latest `send` (this pane's own model and
	// settings) whenever any synced pane sends.
	const sendRef = useRef(send);
	useEffect(() => {
		sendRef.current = send;
	});
	const hub = sync?.synced ? sync.hub : undefined;
	useEffect(
		() =>
			hub?.join(chat.id, {
				chat,
				send: (text, files) => sendRef.current(text, files),
			}),
		[hub, chat],
	);
	const branches = useChatBranches(chat.id);
	// Roadmap 1.7: only while idle, like Regenerate, so a branch never moves under a streaming reply.
	// The handlers go through a ref, so the message rows keep their props (and don't re-render) when a
	// reply starts or ends; the buttons hide themselves while one streams.
	const branching = {
		edit:
			busy || !options
				? undefined
				: (messageId: string, text: string) => {
						editMessage(chat, messageId, text, options).catch(logFailure);
						// An edit is a send, so it counts as `chat_sent`.
						trackSent(options.body.provider);
					},
		switchVersion: busy
			? undefined
			: (index: number, versionId: string) => {
					switchBranch(chat, index, versionId).catch((error: unknown) =>
						logError("Couldn't switch versions:", error),
					);
				},
	};
	const branchingRef = useRef(branching);
	useEffect(() => {
		branchingRef.current = branching;
	});
	// Made once: the React Compiler doesn't keep these closures stable in this component (chat-screen's
	// render-count test caught the person's message re-rendering with every streamed chunk).
	const [{ edit, switchVersion }] = useState(() => ({
		edit: (messageId: string, text: string) =>
			branchingRef.current.edit?.(messageId, text),
		switchVersion: (index: number, versionId: string) =>
			branchingRef.current.switchVersion?.(index, versionId),
	}));
	const retry = options
		? () => regenerate(options).catch(logFailure)
		: undefined;

	return (
		<div
			className="flex h-full min-h-0 min-w-0 flex-col items-center overflow-hidden rounded-pane border bg-card pb-4 text-card-foreground"
			data-chat-status={status}
		>
			{header && (
				<div className="flex w-full shrink-0 flex-col border-b">{header}</div>
			)}
			<div className="w-full flex-1 overflow-auto">
				{messages.length === 0 ? (
					<div className="flex h-full items-center justify-center p-4 text-muted-foreground">
						{empty ??
							(selection
								? "Send a message to start."
								: "Pick a provider and a model to start.")}
					</div>
				) : (
					<MessagesList
						messages={messages}
						chatId={chat.id}
						onRegenerate={
							busy || !options
								? undefined
								: (messageId) =>
										regenerate({ messageId, ...options }).catch(logFailure)
						}
						branches={branches}
						onEdit={options ? edit : undefined}
						onSwitch={switchVersion}
					/>
				)}
			</div>
			{error && (
				<div
					role="alert"
					className="mb-3 flex w-full max-w-3xl items-center gap-3 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
				>
					<span className="flex-1">{error.message}</span>
					{retry && (
						<Button size="sm" variant="outline" onClick={retry}>
							Retry
						</Button>
					)}
				</div>
			)}
			{attachmentErrors.length > 0 && (
				<div
					role="alert"
					aria-label="Attachments not added"
					className="mb-3 flex w-full max-w-3xl items-start gap-3 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
				>
					<ul className="flex-1">
						{attachmentErrors.map((message) => (
							<li key={message}>{message}</li>
						))}
					</ul>
					<Button
						size="sm"
						variant="outline"
						onClick={() => setAttachmentErrors([])}
					>
						Dismiss
					</Button>
				</div>
			)}
			{/* Inset, so the composer doesn't touch a narrow pane's edges. */}
			<div className="flex w-full justify-center px-3">
				{hub ? (
					// Synced panes may run models that read different files: checking each one's model is
					// roadmap 3.3, so a synced composer only checks type, size and count.
					<SyncedComposer
						hub={hub}
						ready={options !== undefined}
						onAttachmentErrors={setAttachmentErrors}
					/>
				) : (
					<Input
						onSubmit={async (text, files) => send(text, files)}
						isLoading={busy || !options}
						onStop={busy ? () => stop() : undefined}
						attachmentSupport={attachmentSupport}
						onAttachmentErrors={setAttachmentErrors}
					/>
				)}
			</div>
		</div>
	);
}

/**
 * A synced pane's composer (decisions 16 and 18): the workspace's shared draft, sending to every synced
 * pane, and a Stop that stops every synced pane that's replying.
 */
function SyncedComposer({
	hub,
	ready,
	onAttachmentErrors,
}: {
	hub: PaneSync;
	ready: boolean;
	onAttachmentErrors: (errors: string[]) => void;
}) {
	const { draft, replying } = usePaneSyncState(hub);
	return (
		<Input
			value={draft}
			onValueChange={hub.setDraft}
			onAttachmentErrors={onAttachmentErrors}
			onSubmit={async (text, files) => hub.sendAll(text, files)}
			isLoading={replying || !ready}
			onStop={replying ? hub.stopAll : undefined}
		/>
	);
}
