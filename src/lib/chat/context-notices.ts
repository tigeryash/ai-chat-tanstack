import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";
import type { ContextLevel } from "./context-usage";

// Context notices the person closed (roadmap R2 S4), by chat id, with the level they were closed at,
// so a notice closed at "nearing" comes back once the chat goes past its context. Kept in this browser.
// Ids and a level only, never chat content.

export const CONTEXT_NOTICES_KEY = "highelo-context-notices";

/** Newest kept, oldest dropped first. */
const MAX_CHATS = 500;
const CHAT_ID_MAX = 200;

const schema = z.record(
	z.string().max(CHAT_ID_MAX),
	z.enum(["nearing", "over"]),
);

const closedNotices = createLocalStore(CONTEXT_NOTICES_KEY, schema, {});

export function closeContextNotice(
	chatId: string,
	level: Exclude<ContextLevel, "under">,
): void {
	const others = Object.entries(closedNotices.read()).filter(
		([id]) => id !== chatId,
	);
	closedNotices.write(
		Object.fromEntries([...others, [chatId, level]].slice(-MAX_CHATS)),
	);
}

/** The level `chatId`'s notice was closed at, if it was. */
export function useClosedContextNotice(
	chatId: string,
): ContextLevel | undefined {
	return closedNotices.use()[chatId];
}
