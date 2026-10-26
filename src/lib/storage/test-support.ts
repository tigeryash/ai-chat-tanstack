import type { UIMessage } from "ai";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { openChatDatabase } from "./db";

// For unit tests: a chat database in an in-memory IndexedDB of its own, so tests never share data.
export function openTestDatabase(name = "test-chats") {
	return openChatDatabase(name, { indexedDB: new IDBFactory(), IDBKeyRange });
}

export function textMessage(
	id: string,
	role: UIMessage["role"],
	text: string,
): UIMessage {
	return { id, role, parts: [{ type: "text", text }] };
}

/** A clock that ticks one millisecond per call, from `start`. */
export function tickingClock(start = 1_000) {
	let time = start;
	return () => time++;
}
