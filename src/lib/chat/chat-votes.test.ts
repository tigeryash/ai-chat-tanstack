// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createDexieChatStore } from "@/lib/storage/dexie-chat-store";
import { openTestDatabase, textMessage } from "@/lib/storage/test-support";
import { saveChat } from "./chat-sessions";
import {
	chatVotesOf,
	forgetChatVotes,
	loadChatVotes,
	voteOnReply,
} from "./chat-votes";

const conversation = [
	textMessage("q1", "user", "hi"),
	textMessage("r1", "assistant", "hello"),
];

describe("chat votes", () => {
	it("saves a vote on a saved chat, and clears it when pressed again", async () => {
		const store = createDexieChatStore({ db: openTestDatabase("votes-a") });
		await store.saveMessages("a1", conversation, null);

		await voteOnReply("a1", "r1", "up", store);
		expect(chatVotesOf("a1")).toEqual({ r1: "up" });
		expect((await store.getChat("a1"))?.votes).toEqual({ r1: "up" });

		await voteOnReply("a1", "r1", "down", store);
		expect((await store.getChat("a1"))?.votes).toEqual({ r1: "down" });

		await voteOnReply("a1", "r1", null, store);
		expect((await store.getChat("a1"))?.votes).toBeUndefined();
	});

	it("keeps a vote made before the chat was saved, and writes it with the first save", async () => {
		const store = createDexieChatStore({ db: openTestDatabase("votes-b") });
		await voteOnReply("b1", "r1", "up", store);
		expect(await store.getChat("b1")).toBeUndefined();

		await saveChat(store, "b1", conversation, null);
		expect((await store.getChat("b1"))?.votes).toEqual({ r1: "up" });
	});

	it("loads a saved chat's votes without overwriting newer ones, and forgets them", () => {
		loadChatVotes("c1", { r1: "up" });
		loadChatVotes("c1", { r1: "down" });
		expect(chatVotesOf("c1")).toEqual({ r1: "up" });
		forgetChatVotes("c1");
		expect(chatVotesOf("c1")).toBeUndefined();
	});
});
