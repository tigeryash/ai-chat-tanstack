import { z } from "@/lib/zod";

// Thumbs up/down on replies (roadmap 3.4): which way the person voted, by reply message id. Stored on
// the chat's row, optional and cleaned on read like `settings`, so it needed no migration. Only the
// vote and the message id: never the reply's text.

export type ReplyVote = "up" | "down";
export type ChatVotes = Readonly<Record<string, ReplyVote>>;

/** Far more replies than a chat holds; stops a hand-edited import from growing without bound. */
export const MAX_VOTES = 10_000;
const MAX_MESSAGE_ID_LENGTH = 256;

const voteSchema = z.enum(["up", "down"]);
export const chatVotesSchema = z
	.record(z.string().min(1).max(MAX_MESSAGE_ID_LENGTH), voteSchema)
	.refine((votes) => Object.keys(votes).length <= MAX_VOTES, "Too many votes.");

/** Votes from storage or an import: bad entries dropped, not all of them. Undefined when none. */
export function cleanVotes(raw: unknown): ChatVotes | undefined {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		return undefined;
	}
	const entries = Object.entries(raw)
		.filter(
			([id, vote]) =>
				id.length > 0 &&
				id.length <= MAX_MESSAGE_ID_LENGTH &&
				voteSchema.safeParse(vote).success,
		)
		.slice(0, MAX_VOTES);
	return entries.length > 0
		? (Object.fromEntries(entries) as ChatVotes)
		: undefined;
}

/** A new set of votes with `messageId`'s set to `vote`, or cleared when null. */
export function withVote(
	votes: ChatVotes | undefined,
	messageId: string,
	vote: ReplyVote | null,
): ChatVotes {
	const { [messageId]: _, ...rest } = votes ?? {};
	return vote ? { ...rest, [messageId]: vote } : rest;
}
