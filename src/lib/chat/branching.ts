import type { Chat } from "@ai-sdk/react";
import type { ChatRequestOptions, UIMessage } from "ai";
import { chatStore } from "@/lib/storage/app-store";
import {
	type ChatBranches,
	EMPTY_BRANCHES,
	editAt,
	regenerateAt,
	switchAt,
} from "@/lib/storage/branches";
import type { ChatStore } from "@/lib/storage/chat-store";
import { chatBranchesOf, setChatBranches } from "./chat-branches";
import { saveChat } from "./chat-sessions";
import { peekOpenChat } from "./open-chats";

// Edit and branch (roadmap 1.7) on an open chat. Editing a user message makes a new version of it and
// asks for a new reply; regenerating a reply (roadmap R4) makes a new version of the reply. Either way
// the old version and what followed it stay, one switch away. All need the chat to be idle: the chat's
// view only offers them then.

/** The longest edited message, like the composer's own limit would be. */
export const MAX_EDIT_LENGTH = 100_000;

function indexOfUserMessage(chat: Chat<UIMessage>, messageId: string): number {
	const index = chat.messages.findIndex((message) => message.id === messageId);
	if (chat.messages[index]?.role !== "user") {
		throw new RangeError("Only a message the person sent can be edited.");
	}
	return index;
}

/**
 * Sends `text` as a new version of the user message `messageId`, keeping its attachments. Resolves when
 * the reply finishes (and the chat, with its branches, is saved by `onFinish`). Empty text does nothing.
 */
export async function editMessage(
	chat: Chat<UIMessage>,
	messageId: string,
	text: string,
	options: ChatRequestOptions,
): Promise<void> {
	const trimmed = text.trim();
	if (trimmed === "" || trimmed.length > MAX_EDIT_LENGTH) return;
	const index = indexOfUserMessage(chat, messageId);
	const original = chat.messages[index] as UIMessage;
	const edited: UIMessage = {
		id: crypto.randomUUID(),
		role: "user",
		parts: [
			{ type: "text", text: trimmed },
			...original.parts.filter((part) => part.type === "file"),
		],
	};
	const next = editAt(
		chat.messages,
		chatBranchesOf(chat.id) ?? EMPTY_BRANCHES,
		index,
		edited,
	);
	setChatBranches(chat.id, next.branches);
	chat.messages = next.path.slice(0, -1);
	await chat.sendMessage(
		{ id: edited.id, role: "user", parts: edited.parts },
		options,
	);
}

/**
 * Streams a new version of the reply `messageId` (any reply, not only the last) into a new branch: the
 * old one and everything after it stay as its sibling. Resolves when the new reply ends (and the chat,
 * with its branches, is saved by `onFinish`). A reply that never arrives (the request failed or was
 * stopped first) puts the old branch back, so a failed regenerate loses nothing.
 */
export async function regenerateReply(
	chat: Chat<UIMessage>,
	messageId: string,
	options: ChatRequestOptions,
	store: ChatStore = chatStore(),
): Promise<void> {
	const index = chat.messages.findIndex((message) => message.id === messageId);
	if (chat.messages[index]?.role !== "assistant") {
		throw new RangeError("Only a reply can be regenerated.");
	}
	const before = {
		path: [...chat.messages],
		branches: chatBranchesOf(chat.id),
	};
	const replyId = crypto.randomUUID();
	const next = regenerateAt(
		before.path,
		before.branches ?? EMPTY_BRANCHES,
		index,
		replyId,
	);
	setChatBranches(chat.id, next.branches);
	try {
		await chat.regenerate({
			...options,
			messageId,
			body: { ...(options.body as object | undefined), replyId },
		});
	} finally {
		await restoreIfNoReply(chat, before, index, replyId, store);
	}
}

async function restoreIfNoReply(
	chat: Chat<UIMessage>,
	before: { path: UIMessage[]; branches: ChatBranches | undefined },
	index: number,
	replyId: string,
	store: ChatStore,
) {
	const shown = chat.messages;
	const arrived = shown[index]?.id === replyId;
	// Only when nothing else changed the chat since: it ends right where the reply should have been.
	const untouched =
		shown.length === index &&
		shown.every((message, i) => message.id === before.path[i]?.id);
	if (arrived || !untouched) return;
	if (before.branches) setChatBranches(chat.id, before.branches);
	else setChatBranches(chat.id, EMPTY_BRANCHES);
	chat.messages = before.path;
	const open = peekOpenChat(chat.id);
	if (open?.chat !== chat) return;
	await saveChat(store, chat.id, before.path, open.ownerId);
}

/** Shows another version of the message at `index` and saves the chat, so a reload shows it too. */
export async function switchBranch(
	chat: Chat<UIMessage>,
	index: number,
	siblingId: string,
	store: ChatStore = chatStore(),
): Promise<void> {
	const next = switchAt(
		chat.messages,
		chatBranchesOf(chat.id) ?? EMPTY_BRANCHES,
		index,
		siblingId,
	);
	setChatBranches(chat.id, next.branches);
	chat.messages = next.path;
	const open = peekOpenChat(chat.id);
	if (open?.chat !== chat) return;
	await saveChat(store, chat.id, next.path, open.ownerId);
}
