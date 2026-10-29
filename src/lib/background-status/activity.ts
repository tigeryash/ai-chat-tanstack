// Reply activity across every open chat in this tab (roadmap 3.10). `chat-sessions.ts` reports into
// it, so it covers all chats at once, however many panes show them. Only chat ids and outcomes live
// here, never message content.

export type ReplyOutcome = "finished" | "failed";

export interface ReplyEnded {
	chatId: string;
	outcome: ReplyOutcome;
}

const replying = new Set<string>();
const changeListeners = new Set<() => void>();
const endListeners = new Set<(event: ReplyEnded) => void>();

function notifyChange() {
	for (const listener of changeListeners) listener();
}

/** Marks whether a chat is replying right now (the `Chat` is `submitted` or `streaming`). */
export function setReplying(chatId: string, isReplying: boolean): void {
	if (replying.has(chatId) === isReplying) return;
	if (isReplying) replying.add(chatId);
	else replying.delete(chatId);
	notifyChange();
}

/** A reply finished or failed. Stopped replies aren't reported: the person ended them. */
export function reportReplyEnded(event: ReplyEnded): void {
	for (const listener of endListeners) listener(event);
}

/** How many chats are replying right now. */
export function replyingCount(): number {
	return replying.size;
}

export function subscribeReplying(listener: () => void): () => void {
	changeListeners.add(listener);
	return () => changeListeners.delete(listener);
}

export function subscribeReplyEnded(
	listener: (event: ReplyEnded) => void,
): () => void {
	endListeners.add(listener);
	return () => endListeners.delete(listener);
}
