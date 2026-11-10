import type { UIMessage } from "ai";
import { describe, expect, it, vi } from "vitest";
import { siblingsAt } from "@/lib/storage/branches";
import type { ChatStore } from "@/lib/storage/chat-store";
import { createDexieChatStore } from "@/lib/storage/dexie-chat-store";
import { openTestDatabase } from "@/lib/storage/test-support";
import { regenerateReply, switchBranch } from "./branching";
import { BrowserChatTransport } from "./browser-transport";
import { chatBranchesOf } from "./chat-branches";
import { openNewChat } from "./chat-sessions";
import { chatVotesOf, voteOnReply } from "./chat-votes";
import { mockChatModel } from "./mock-model";

const SELECTION = { provider: "local", model: "mock" } as const;
const OPTIONS = { body: SELECTION };

const textOf = (message: UIMessage | undefined) =>
	message?.parts.flatMap((part) => (part.type === "text" ? [part.text] : []));

/** A chat whose mock model answers "reply 1", "reply 2", … in turn. */
function numberedChat(store: ChatStore) {
	let count = 0;
	const transport = new BrowserChatTransport(async () => {
		count += 1;
		return mockChatModel({ text: [`reply ${count}`] });
	});
	return openNewChat({ transport, store, ownerId: null });
}

async function savedChat(store: ChatStore, id: string, length: number) {
	return vi.waitFor(async () => {
		const found = await store.getChat(id);
		if (found?.messages.length !== length) throw new Error("not saved yet");
		return found;
	});
}

describe("regenerating a reply into a branch", () => {
	it("keeps the old reply as a sibling, with its own stats and vote", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		const chat = numberedChat(store);
		await chat.sendMessage({ text: "hello" }, OPTIONS);
		const original = chat.messages[1] as UIMessage;
		await savedChat(store, chat.id, 2);
		await voteOnReply(chat.id, original.id, "up", store);

		await regenerateReply(chat, original.id, OPTIONS, store);

		const regenerated = chat.messages[1] as UIMessage;
		expect(regenerated.id).not.toBe(original.id);
		expect(textOf(regenerated)).toEqual(["reply 2"]);
		const branches = chatBranchesOf(chat.id);
		expect(branches && siblingsAt(chat.messages, branches, 1)).toEqual({
			ids: [original.id, regenerated.id],
			index: 1,
		});
		// Each reply keeps its own usage; the vote stays on the old one.
		expect(regenerated.metadata).toMatchObject({
			usage: { outputTokens: 5 },
		});
		expect(chatVotesOf(chat.id)).toEqual({ [original.id]: "up" });

		const saved = await vi.waitFor(async () => {
			const found = await store.getChat(chat.id);
			if (found?.messages[1]?.id !== regenerated.id) throw new Error("old");
			return found;
		});
		expect(saved.votes).toEqual({ [original.id]: "up" });
		const old = saved.branches?.messages.find(
			(entry) => entry.message.id === original.id,
		);
		expect(textOf(old?.message)).toEqual(["reply 1"]);
		expect(old?.message.metadata).toMatchObject({ usage: { outputTokens: 5 } });

		await switchBranch(chat, 1, original.id, store);
		expect(textOf(chat.messages[1])).toEqual(["reply 1"]);
	});

	it("regenerates a middle reply, taking the rest of the chat into the old branch", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		const chat = numberedChat(store);
		await chat.sendMessage({ text: "one" }, OPTIONS);
		await chat.sendMessage({ text: "two" }, OPTIONS);
		const before = chat.messages.map((message) => message.id);

		await regenerateReply(chat, before[1] as string, OPTIONS, store);

		expect(chat.messages).toHaveLength(2);
		expect(textOf(chat.messages[1])).toEqual(["reply 3"]);
		await switchBranch(chat, 1, before[1] as string, store);
		expect(chat.messages.map((message) => message.id)).toEqual(before);
	});

	it("puts the old reply back when the new one never arrives", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		let fail = false;
		const transport = new BrowserChatTransport(async () => {
			if (fail) throw new Error("offline");
			return mockChatModel({ text: ["first"] });
		});
		const chat = openNewChat({ transport, store, ownerId: null });
		await chat.sendMessage({ text: "hello" }, OPTIONS);
		const before = chat.messages.map((message) => message.id);
		fail = true;

		await regenerateReply(chat, before[1] as string, OPTIONS, store);

		expect(chat.messages.map((message) => message.id)).toEqual(before);
		expect(chatBranchesOf(chat.id)?.forks ?? []).toEqual([]);
		const saved = await savedChat(store, chat.id, 2);
		expect(saved.messages.map((message) => message.id)).toEqual(before);
	});

	it("stopping mid-regenerate keeps both versions: the old reply and what streamed", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		let slow = false;
		const transport = new BrowserChatTransport(async () =>
			slow
				? mockChatModel({ text: ["part ", "of ", "it"], chunkDelayInMs: 200 })
				: mockChatModel({ text: ["first"] }),
		);
		const chat = openNewChat({ transport, store, ownerId: null });
		await chat.sendMessage({ text: "hello" }, OPTIONS);
		const original = chat.messages[1] as UIMessage;
		slow = true;

		const running = regenerateReply(chat, original.id, OPTIONS, store);
		await vi.waitFor(() => {
			if (textOf(chat.messages[1])?.join("") !== "part ") throw new Error();
		});
		await chat.stop();
		await running;

		const partial = chat.messages[1] as UIMessage;
		expect(partial.id).not.toBe(original.id);
		const branches = chatBranchesOf(chat.id);
		expect(branches && siblingsAt(chat.messages, branches, 1)?.ids).toEqual([
			original.id,
			partial.id,
		]);
		const saved = await vi.waitFor(async () => {
			const found = await store.getChat(chat.id);
			if (found?.messages[1]?.id !== partial.id) throw new Error("old");
			return found;
		});
		expect(saved.branches?.forks[0]?.childIds).toEqual([
			original.id,
			partial.id,
		]);
	});

	it("refuses to regenerate the person's own message", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		const chat = numberedChat(store);
		await chat.sendMessage({ text: "hello" }, OPTIONS);
		await expect(
			regenerateReply(chat, chat.messages[0]?.id as string, OPTIONS, store),
		).rejects.toThrow(RangeError);
	});
});
