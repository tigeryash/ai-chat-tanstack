import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatStore } from "@/lib/storage/chat-store";
import {
	addOpenChat,
	closeChat,
	getOpenChat,
	isChatOpen,
	MAX_IDLE_OPEN_CHATS,
	type OpenChat,
	peekOpenChat,
	retainChat,
	setChatOwner,
	subscribeOpenChats,
} from "./open-chats";

// The tab's open chats: least recently used idle ones are released past the limit, unless they're
// busy or on screen. `chat-sessions.test.ts` covers the same with real `Chat` objects.

type Status = Chat<UIMessage>["status"];

/** Only what open-chats.ts reads: the status, and `stop` for closing. */
function fakeChat(id: string, status: Status = "ready"): OpenChat {
	const chat = { id, status, stop: async () => {} };
	return { chat: chat as unknown as Chat<UIMessage>, ownerId: null };
}

const opened: string[] = [];
function open(id: string, status?: Status): OpenChat {
	const entry = fakeChat(id, status);
	opened.push(id);
	addOpenChat(id, entry);
	return entry;
}

/** Fills the tab to the limit with ids `prefix-0`, `prefix-1`, …, oldest first. */
function fill(prefix: string, count = MAX_IDLE_OPEN_CHATS): string[] {
	const ids = Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
	for (const id of ids) open(id);
	return ids;
}

afterEach(() => {
	for (const id of opened.splice(0)) closeChat(id);
});

describe("open chats", () => {
	it("keeps the limit, releasing the least recently used idle chat", () => {
		const ids = fill("lru");
		expect(ids.every(isChatOpen)).toBe(true);
		open("lru-next");
		expect(isChatOpen(ids[0])).toBe(false);
		expect(isChatOpen(ids[1])).toBe(true);
		expect(isChatOpen("lru-next")).toBe(true);
	});

	it("counts getOpenChat as a use, but not peekOpenChat", () => {
		const ids = fill("use");
		expect(getOpenChat(ids[0])).toBeDefined();
		expect(peekOpenChat(ids[1])).toBeDefined();
		open("use-next");
		expect(isChatOpen(ids[0])).toBe(true);
		expect(isChatOpen(ids[1])).toBe(false);
	});

	it("never releases a busy chat", () => {
		open("busy", "streaming");
		const ids = fill("busy-others");
		expect(isChatOpen("busy")).toBe(true);
		expect(isChatOpen(ids[0])).toBe(false);
	});

	it("keeps a retained chat until every place showing it lets go", () => {
		open("shown");
		const pane = retainChat("shown");
		const route = retainChat("shown");
		fill("shown-others");
		expect(isChatOpen("shown")).toBe(true);

		route();
		route(); // letting go twice counts once
		open("shown-more-1");
		expect(isChatOpen("shown")).toBe(true);

		pane();
		open("shown-more-2");
		expect(isChatOpen("shown")).toBe(false);
	});

	it("keeps a chat retained before it's open, for when it's reopened", () => {
		const letGo = retainChat("later");
		fill("later-others");
		open("later");
		open("later-more");
		expect(isChatOpen("later")).toBe(true);
		letGo();
	});

	it("tells subscribers when chats open, are released, close or change owner", async () => {
		const listener = vi.fn();
		const stop = subscribeOpenChats(listener);
		const ids = fill("notify");
		expect(listener).toHaveBeenCalledTimes(ids.length);

		listener.mockClear();
		open("notify-next"); // releases ids[0] in the same change
		expect(listener).toHaveBeenCalledTimes(1);
		expect(peekOpenChat(ids[0])).toBeUndefined();

		listener.mockClear();
		closeChat("notify-next");
		expect(listener).toHaveBeenCalledTimes(1);

		listener.mockClear();
		const owned = peekOpenChat(ids[1]);
		// Only `setOwner` is called on the store.
		const store = { setOwner: async () => {} } as unknown as ChatStore;
		await setChatOwner([ids[1]], "user-1", store);
		expect(listener).toHaveBeenCalledTimes(1);
		// A new snapshot, so `useOpenChat` re-renders with the new owner.
		expect(peekOpenChat(ids[1])).not.toBe(owned);
		expect(peekOpenChat(ids[1])?.ownerId).toBe("user-1");

		stop();
		open("notify-after");
		expect(listener).toHaveBeenCalledTimes(1);
	});
});
