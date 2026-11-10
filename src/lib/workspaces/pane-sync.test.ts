import type { UIMessage } from "ai";
import { describe, expect, it, vi } from "vitest";
import { toFilePart } from "@/lib/attachments/file-object";
import { textMessage } from "@/lib/storage/test-support";
import { createPaneSync, type SyncedPane, userHistory } from "./pane-sync";

// Files are "read" at once: FileReader and image compression are the browser's, and not what's tested here.
vi.mock("@/lib/attachments/process", () => ({
	processAttachment: async (file: File) => ({ file, base64: "data:," }),
}));

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
		expect(sends[0]).toHaveBeenCalledWith("Compare", undefined);
		expect(sends[1]).toHaveBeenCalledWith("Compare", undefined);
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
		const files = [
			{ type: "file" as const, mediaType: "image/png", url: "data:," },
		];
		sync.sendAll("x", files);
		expect(second).toHaveBeenCalledWith("x", files);
	});

	describe("attachments per pane (roadmap 3.3, decision 17)", () => {
		const png = {
			type: "file" as const,
			mediaType: "image/png",
			url: "data:,",
		};
		const notes = {
			type: "file" as const,
			mediaType: "text/plain",
			url: "data:,",
		};
		const image = () => new File(["x"], "red.png", { type: "image/png" });
		const markdown = () =>
			new File(["# hi"], "notes.md", { type: "text/markdown" });
		const twoPanes = () => {
			const sync = createPaneSync();
			const reads = vi.fn();
			const textOnly = vi.fn();
			sync.join("reads", {
				chat: fakeChat(),
				send: reads,
				support: () => ({ images: true, pdfs: true }),
			});
			sync.join("text", {
				chat: fakeChat(),
				send: textOnly,
				support: () => ({ images: false, pdfs: false }),
			});
			return { sync, reads, textOnly };
		};

		it("sends each pane only the files its model reads", () => {
			const { sync, reads, textOnly } = twoPanes();
			sync.sendAll("Describe", [png, notes]);
			expect(reads).toHaveBeenCalledWith("Describe", [png, notes]);
			expect(textOnly).toHaveBeenCalledWith("Describe", [notes]);
		});

		it("sends a text or code file (1.6b) to every pane, an image only to the one that reads it", () => {
			const { sync, reads, textOnly } = twoPanes();
			// `.ts` files can come in as video/mp2t; only image and PDF types ever depend on the model.
			const code = { ...notes, mediaType: "video/mp2t", filename: "a.ts" };
			sync.sendAll("Review", [png, notes, code]);
			expect(reads).toHaveBeenCalledWith("Review", [png, notes, code]);
			expect(textOnly).toHaveBeenCalledWith("Review", [notes, code]);
		});

		it("gives every synced composer one list: a file added or removed in one is added or removed in all", async () => {
			const { sync } = twoPanes();
			const onChange = vi.fn();
			sync.subscribe(onChange);
			await sync.attachments.add([image(), markdown()]);
			// Reading the files doesn't change their names or types, so panes don't re-render for it.
			expect(onChange).toHaveBeenCalledOnce();
			expect(sync.getState().attachments).toEqual([
				{ name: "red.png", mediaType: "image/png" },
				{ name: "notes.md", mediaType: "text/markdown" },
			]);

			const [first] = sync.attachments.getFiles();
			sync.attachments.remove(first?.id ?? "");
			expect(sync.getState().attachments).toEqual([
				{ name: "notes.md", mediaType: "text/markdown" },
			]);
		});

		it("keeps a skip until the send, then clears it with the files", async () => {
			const { sync, reads, textOnly } = twoPanes();
			await sync.attachments.add([image()]);
			sync.setSkipped("text", true);
			sync.setDraft("typing more");
			expect(sync.getState().skipped).toEqual(["text"]);

			// What a composer does on Enter: send what's attached, then clear the shared list.
			const files = await sync.attachments.settled();
			sync.sendAll("Describe", files.map(toFilePart));
			sync.attachments.clear();

			expect(reads).toHaveBeenCalledOnce();
			expect(textOnly).not.toHaveBeenCalled();
			expect(sync.getState()).toMatchObject({ attachments: [], skipped: [] });
			expect(sync.attachments.getFiles()).toEqual([]);
		});

		it("forgets a skip when the files that asked for it are removed", async () => {
			const { sync } = twoPanes();
			await sync.attachments.add([image()]);
			sync.setSkipped("text", true);
			sync.attachments.clear();
			expect(sync.getState().skipped).toEqual([]);
		});

		it("drops a pane's choice when it leaves, and the files when the workspace goes", async () => {
			const sync = createPaneSync();
			const leave = sync.join("a", { chat: fakeChat(), send: vi.fn() });
			await sync.attachments.add([image()]);
			sync.setSkipped("a", true);
			leave();
			expect(sync.getState().skipped).toEqual([]);
			sync.dispose();
			expect(sync.getState().attachments).toEqual([]);
		});
	});
});
