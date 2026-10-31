// @vitest-environment jsdom
import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
	CHAT_MODEL_CHOICES_KEY,
	holdChatModelChoice,
	readChatModelChoice,
	storeChatModelChoice,
} from "./chat-model-choice";
import { readModelChoice } from "./model-selection";

const opus = {
	provider: "openrouter",
	model: "anthropic/claude-opus-5.5",
	gatewayId: "anthropic/claude-opus-5.5",
} as const;
const gpt = { provider: "openai", model: "gpt-5.5" } as const;

describe("chat model choice", () => {
	it("is kept per chat, and the last one is the default for new chats", () => {
		storeChatModelChoice("chat-a", opus);
		storeChatModelChoice("chat-b", gpt);

		expect(readChatModelChoice("chat-a")).toEqual(opus);
		expect(readChatModelChoice("chat-b")).toEqual(gpt);
		expect(readChatModelChoice("new-chat")).toEqual(gpt);
		expect(readModelChoice()).toEqual(gpt);
		expect(
			JSON.parse(localStorage.getItem(CHAT_MODEL_CHOICES_KEY) ?? "[]"),
		).toEqual([
			["chat-a", opus],
			["chat-b", gpt],
		]);
	});

	it("falls back to the model of the chat's last reply", () => {
		const messages: UIMessage[] = [
			{ id: "1", role: "user", parts: [] },
			{ id: "2", role: "assistant", parts: [], metadata: opus },
			{ id: "3", role: "assistant", parts: [], metadata: { junk: true } },
		];
		expect(readChatModelChoice("imported-chat", messages)).toEqual(opus);
	});

	it("holds a pane's model, so a pick in another pane doesn't move it (roadmap 3.1)", () => {
		storeChatModelChoice("first", opus);
		holdChatModelChoice("pane-1");
		holdChatModelChoice("pane-2");
		storeChatModelChoice("pane-2", gpt);

		expect(readChatModelChoice("pane-1")).toEqual(opus);
		expect(readChatModelChoice("pane-2")).toEqual(gpt);
		// Holding again keeps a chat's own choice.
		holdChatModelChoice("pane-2");
		expect(readChatModelChoice("pane-2")).toEqual(gpt);
	});
});
