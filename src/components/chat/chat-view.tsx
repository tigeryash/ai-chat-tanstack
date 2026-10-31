import { type Chat, useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { type ReactNode, useEffect, useRef } from "react";
import MessagesList from "@/components/chat/chatstuff/messages-list";
import { Input } from "@/components/chat/input";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/track";
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
}: ChatViewProps) {
	const { messages, sendMessage, regenerate, stop, status, error } = useChat({
		chat,
		throttle: STREAM_THROTTLE_MS,
	});
	const busy = status === "submitted" || status === "streaming";
	const options = selection && { body: { ...selection, settings } };

	const send = (text: string) => {
		if (!options) return;
		// Not awaited: it resolves when the reply finishes, and the composer clears once this returns.
		sendMessage({ text }, options).catch(logFailure);
		track("chat_sent", {
			providerKind:
				options.body.provider === LOCAL_PROVIDER ? "local" : "hosted",
			paneCount,
			hasAttachment: false,
		});
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
		() => hub?.join(chat.id, { chat, send: (text) => sendRef.current(text) }),
		[hub, chat],
	);
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
						// The selection itself (kept by value upstream), so finished messages keep their props.
						currentModel={selection}
						onRegenerate={
							busy || !options
								? undefined
								: (messageId) =>
										regenerate({ messageId, ...options }).catch(logFailure)
						}
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
			{/* Inset, so the composer doesn't touch a narrow pane's edges. */}
			<div className="flex w-full justify-center px-3">
				{hub ? (
					<SyncedComposer hub={hub} ready={options !== undefined} />
				) : (
					<Input
						onSubmit={async (text) => send(text)}
						isLoading={busy || !options}
						onStop={busy ? () => stop() : undefined}
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
function SyncedComposer({ hub, ready }: { hub: PaneSync; ready: boolean }) {
	const { draft, replying } = usePaneSyncState(hub);
	return (
		<Input
			value={draft}
			onValueChange={hub.setDraft}
			onSubmit={async (text) => hub.sendAll(text)}
			isLoading={replying || !ready}
			onStop={replying ? hub.stopAll : undefined}
		/>
	);
}
