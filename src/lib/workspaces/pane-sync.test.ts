import type { UIMessage } from "ai";
import { describe, expect, it, vi } from "vitest";
import { textMessage } from "@/lib/storage/test-support";
import { createPaneSync, type SyncedPane, userHistory } from "./pane-sync";

/** Enough of an AI SDK `Chat` for the hub: status, messages, stop and the change callbacks. */
function fakeChat(messages: UIMessage[] = []) {
	const statusListeners = new Set<() => void>();
	const messageListeners = new Set<() => void>();
	const chat = {
		status: "ready" as SyncedPane["chat"]["status"],
		messages,
		stop: vi.fn(async () => {
			chat.setStatus("ready");
		}),
		"~registerStatusCallback": (listener: () => void) => {
			statusListeners.add(listener);
			return () => statusListeners.delete(listener);
		},
		"~registerMessagesCallback": (listener: () => void) => {
			messageListeners.add(listener);
			return () => messageListeners.delete(listener);
		},
		setStatus(status: SyncedPane["chat"]["status"]) {
			chat.status = status;
			for (const listener of statusListeners) listener();
		},
		setMessages(next: UIMessage[]) {
			chat.messages = next;
			for (const listener of messageListeners) listener();
		},
		listeners: () => statusListeners.size + messageListeners.size,
	};
	return chat;
}

const asked = (...texts: string[]) =>
	texts.map((text, index) => textMessage(`u${index}`, "user", text));

describe("pane sync", () => {
	it("shares one draft", () => {
		const sync = createPaneSync();
		const onChange = vi.fn();
		sync.subscribe(onChange);
		sync.setDraft("hello");
		sync.setDraft("hello");
		expect(sync.getState().draft).toBe("hello");
		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it("sends to every synced pane, each through its own send", () => {
		const sync = createPaneSync();
		const sends = [vi.fn(), vi.fn(), vi.fn()];
		const leave = sends.map((send, index) =>
			sync.join(`p${index}`, { chat: fakeChat(), send }),
		);
		leave[2]?.();
		sync.sendAll("Compare");
		expect(sends[0]).toHaveBeenCalledWith("Compare");
		expect(sends[1]).toHaveBeenCalledWith("Compare");
		expect(sends[2]).not.toHaveBeenCalled();
	});

	it("stops every synced pane that's replying (decision 18)", () => {
		const sync = createPaneSync();
		const busy = fakeChat();
		const idle = fakeChat();
		sync.join("a", { chat: busy, send: vi.fn() });
		sync.join("b", { chat: idle, send: vi.fn() });

		busy.setStatus("streaming");
		expect(sync.getState().replying).toBe(true);
		sync.stopAll();
		expect(busy.stop).toHaveBeenCalledOnce();
		expect(idle.stop).not.toHaveBeenCalled();
		expect(sync.getState().replying).toBe(false);
	});

	it("reports diverged histories among synced panes only (decision 16)", () => {
		const sync = createPaneSync();
		const a = fakeChat(asked("one"));
		const b = fakeChat(asked("one"));
		sync.join("a", { chat: a, send: vi.fn() });
		const leaveB = sync.join("b", { chat: b, send: vi.fn() });
		expect(sync.getState().diverged).toBe(false);

		b.setMessages([
			...asked("one", "only b"),
			textMessage("r", "assistant", "reply"),
		]);
		expect(sync.getState().diverged).toBe(true);

		// Replies don't count, and an unsynced pane isn't compared.
		leaveB();
		expect(sync.getState().diverged).toBe(false);
		expect(b.listeners()).toBe(0);
	});

	it("compares what each pane was asked, not what it answered", () => {
		expect(
			userHistory([
				...asked("hi"),
				textMessage("r1", "assistant", "first model's answer"),
			]),
		).toBe(
			userHistory([...asked("hi"), textMessage("r2", "assistant", "other")]),
		);
	});

	it("rejoining a pane replaces its entry", () => {
		const sync = createPaneSync();
		const first = fakeChat();
		const second = vi.fn();
		const leaveFirst = sync.join("a", { chat: first, send: vi.fn() });
		sync.join("a", { chat: fakeChat(), send: second });
		expect(first.listeners()).toBe(0);
		leaveFirst();
		sync.sendAll("x");
		expect(second).toHaveBeenCalledWith("x");
	});
});
