import { createLocalStore } from "@/lib/local-store";
import { chatStore } from "@/lib/storage/app-store";
import type { ChatStore } from "@/lib/storage/chat-store";
import { chatsOwnedBy, noAccountChats } from "@/lib/storage/ownership";
import {
	deleteWorkspaceAs,
	dropDeletedPanes,
} from "@/lib/workspaces/workspace-cleanup";
import { z } from "@/lib/zod";
import { deleteChats, setChatOwner } from "./open-chats";

// What happens to chats on this device when people sign in and out (roadmap 1.9). After sign-in, an
// account is asked once per browser what to do with the chats made signed out. Signing out hides the
// account's chats, or removes them from this browser if the person asks. Workspaces follow their chats
// on every answer (Yash, 2026-11-07; quality audit Q2, W4).

/** User IDs of the accounts that answered the question in this browser. Holds no chat content. */
export const NO_ACCOUNT_PROMPT_KEY = "highelo-no-account-chats-answered";
const MAX_ANSWERS = 50;

const answered = createLocalStore<string[]>(
	NO_ACCOUNT_PROMPT_KEY,
	z.array(z.string().min(1).max(256)).max(MAX_ANSWERS),
	[],
);

/** Wrapped in a `use…` function so React (and its compiler) treat the read as a hook. */
export function useNoAccountPromptAnswered(userId: string): boolean {
	return answered.use().includes(userId);
}

export type NoAccountChoice = "add" | "keep" | "delete";

/**
 * Acts on the account's answer for every chat and workspace made signed out, then remembers it. "add"
 * gives them to the account (only in this browser until sync exists, roadmap Phase 6), "keep" leaves
 * them, and "delete" deletes them here. Panes of an account's chats in a no-account workspace stay.
 */
export async function answerNoAccountPrompt(
	choice: NoAccountChoice,
	userId: string,
	store: ChatStore = chatStore(),
): Promise<void> {
	if (choice !== "keep") {
		const ids = noAccountChats(await store.listChats()).map((chat) => chat.id);
		const workspaceIds = noAccountChats(await store.listWorkspaces()).map(
			(workspace) => workspace.id,
		);
		if (choice === "add") {
			await setChatOwner(ids, userId, store);
			await store.setWorkspaceOwner(workspaceIds, userId);
		} else {
			for (const id of workspaceIds) await deleteWorkspaceAs(id, null, store);
			await deleteChats(ids, store);
			await dropDeletedPanes(ids, store);
		}
	}
	const others = answered.read().filter((id) => id !== userId);
	answered.write([...others, userId].slice(-MAX_ANSWERS));
}

/**
 * Deletes the account's chats and workspaces from this browser, leaving chats made signed out alone
 * (in an account's workspace, they stay as chats of their own).
 */
export async function removeAccountChats(
	userId: string,
	store: ChatStore = chatStore(),
): Promise<void> {
	const owned = chatsOwnedBy(await store.listChats(), userId).map(
		(chat) => chat.id,
	);
	await deleteChats(owned, store);
	const workspaces = chatsOwnedBy(await store.listWorkspaces(), userId);
	for (const { id } of workspaces) await store.deleteWorkspace(id);
	await dropDeletedPanes(owned, store);
}
