import type { UIMessage } from "ai";
import { z } from "@/lib/zod";

// Edit and branch (roadmap 1.7). A chat is a tree of messages, but the app (the AI SDK `Chat`, the
// sidebar, workspaces, the transport) only ever sees one path through it: `Chat.messages`. Everything
// else is here:
// - `forks`: each place with more than one version of the next message (only user messages fork, by
//   editing), its versions in the order they were made, and which one was shown last;
// - `messages`: every message that isn't on the path, with the id of the message it follows.
// The functions below are pure: they take the path and its branches and return new ones.

/** Stands for "before the first message" in a fork's `parentId`. */
export type ParentId = string | null;

export interface Fork {
	parentId: ParentId;
	/** The versions of the next message, oldest first. Always two or more. */
	childIds: string[];
	/** The version shown last, so going back to an older branch shows what it showed then. */
	activeId: string;
}

export interface BranchMessage {
	parentId: ParentId;
	message: UIMessage;
}

export interface ChatBranches {
	forks: Fork[];
	messages: BranchMessage[];
}

export const EMPTY_BRANCHES: ChatBranches = { forks: [], messages: [] };

const messageId = z.string().min(1).max(256);
const parentId = messageId.nullable();

/** The stored shape. Messages are checked separately, against AI SDK's schema (format.ts). */
export const branchesSchema = z.object({
	forks: z.array(
		z.object({
			parentId,
			childIds: z.array(messageId),
			activeId: messageId,
		}),
	),
	messages: z.array(z.object({ parentId, message: z.unknown() })),
});

export function hasBranches(branches: ChatBranches | undefined): boolean {
	return (branches?.forks.length ?? 0) > 0;
}

const parentAt = (path: readonly UIMessage[], index: number): ParentId =>
	index === 0 ? null : (path[index - 1]?.id ?? null);

const forkAt = (branches: ChatBranches, parent: ParentId) =>
	branches.forks.find((fork) => fork.parentId === parent);

/** Takes `path[index]` and everything after it off the path, keeping each one's parent. */
function offPath(path: readonly UIMessage[], index: number): BranchMessage[] {
	return path
		.slice(index)
		.map((message, i) => ({ parentId: parentAt(path, index + i), message }));
}

export interface Siblings {
	/** The versions of this message, oldest first. */
	ids: string[];
	/** Where the shown one is in `ids`. */
	index: number;
}

/** The versions of `path[index]`, or undefined when it has only the one. */
export function siblingsAt(
	path: readonly UIMessage[],
	branches: ChatBranches,
	index: number,
): Siblings | undefined {
	const message = path[index];
	if (!message) return undefined;
	const fork = forkAt(branches, parentAt(path, index));
	const position = fork?.childIds.indexOf(message.id) ?? -1;
	return fork && position >= 0
		? { ids: fork.childIds, index: position }
		: undefined;
}

/**
 * Replaces `path[index]` with `edited`, a new version of it: the old one and its replies move off the
 * path, and `edited` becomes the newest version. The caller sends `edited` for a reply.
 */
export function editAt(
	path: readonly UIMessage[],
	branches: ChatBranches,
	index: number,
	edited: UIMessage,
): { path: UIMessage[]; branches: ChatBranches } {
	const original = path[index];
	if (!original) throw new RangeError("No message to edit there.");
	const parent = parentAt(path, index);
	const fork = forkAt(branches, parent);
	const forks = fork
		? branches.forks.map((entry) =>
				entry === fork
					? {
							...entry,
							childIds: [...entry.childIds, edited.id],
							activeId: edited.id,
						}
					: entry,
			)
		: [
				...branches.forks,
				{
					parentId: parent,
					childIds: [original.id, edited.id],
					activeId: edited.id,
				},
			];
	return {
		path: [...path.slice(0, index), edited],
		branches: {
			forks,
			messages: [...branches.messages, ...offPath(path, index)],
		},
	};
}

/**
 * Shows another version of `path[index]` (one of `siblingsAt(...).ids`), with the replies it had when
 * it was last shown. The current version and its replies move off the path.
 */
export function switchAt(
	path: readonly UIMessage[],
	branches: ChatBranches,
	index: number,
	siblingId: string,
): { path: UIMessage[]; branches: ChatBranches } {
	const parent = parentAt(path, index);
	const fork = forkAt(branches, parent);
	if (!fork?.childIds.includes(siblingId)) {
		throw new RangeError("That isn't a version of this message.");
	}
	if (path[index]?.id === siblingId) {
		return { path: [...path], branches };
	}
	let pool = [...branches.messages, ...offPath(path, index)];
	const take = (id: string) => {
		const found = pool.find((entry) => entry.message.id === id);
		pool = pool.filter((entry) => entry !== found);
		return found?.message;
	};
	const forks = branches.forks.map((entry) =>
		entry === fork ? { ...entry, activeId: siblingId } : entry,
	);
	const tail: UIMessage[] = [];
	let next = take(siblingId);
	while (next) {
		tail.push(next);
		const at: string = next.id;
		const nextId =
			forks.find((entry) => entry.parentId === at)?.activeId ??
			pool.find((entry) => entry.parentId === at)?.message.id;
		next = nextId === undefined ? undefined : take(nextId);
	}
	return {
		path: [...path.slice(0, index), ...tail],
		branches: { forks, messages: pool },
	};
}

/**
 * Drops what the path no longer reaches: off-path messages whose parent is gone (a regenerated reply
 * takes nothing with it, since only user messages fork) or that are back on the path, and forks left
 * with one version. A fork on the path shows the path's message.
 */
export function normalizeBranches(
	path: readonly UIMessage[],
	branches: ChatBranches,
): ChatBranches {
	const onPath = new Set(path.map((message) => message.id));
	const kept = new Map<string, BranchMessage>();
	const reachable = (parent: ParentId) =>
		parent === null || onPath.has(parent) || kept.has(parent);
	// Parents come before children in `messages` (each edit appends a whole branch), but a few passes
	// keep this right whatever the order.
	let remaining = branches.messages.filter(
		(entry) => !onPath.has(entry.message.id),
	);
	let progress = true;
	while (progress) {
		progress = false;
		const next: BranchMessage[] = [];
		for (const entry of remaining) {
			if (kept.has(entry.message.id)) continue;
			if (reachable(entry.parentId)) {
				kept.set(entry.message.id, entry);
				progress = true;
			} else next.push(entry);
		}
		remaining = next;
	}
	const exists = (id: string) => onPath.has(id) || kept.has(id);
	const forks = branches.forks.flatMap((fork) => {
		if (!reachable(fork.parentId)) return [];
		const childIds = [...new Set(fork.childIds)].filter(exists);
		if (childIds.length < 2) return [];
		const shown = childIds.find((id) => onPath.has(id));
		const activeId =
			shown ?? (childIds.includes(fork.activeId) ? fork.activeId : childIds[0]);
		return [{ ...fork, childIds, activeId }];
	});
	// One fork per parent: the first wins if a bad file has two.
	const unique = forks.filter(
		(fork, i) => forks.findIndex((f) => f.parentId === fork.parentId) === i,
	);
	return { forks: unique, messages: [...kept.values()] };
}
