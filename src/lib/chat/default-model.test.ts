// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { readChatModelChoice, storeChatModelChoice } from "./chat-model-choice";
import {
	DEFAULT_MODEL_STORAGE_KEY,
	LAST_USED_DEFAULT,
	readDefaultModelChoice,
	resolveDefaultModel,
} from "./default-model";

const opus = {
	provider: "openrouter",
	model: "anthropic/claude-opus-5.5",
	gatewayId: "anthropic/claude-opus-5.5",
	autoHost: true,
} as const;
const gpt = { provider: "openai", model: "gpt-5.5" } as const;

describe("default model for new chats", () => {
	beforeEach(() => localStorage.clear());

	it("is the last pick by default, or nothing before the first pick", () => {
		expect(resolveDefaultModel(LAST_USED_DEFAULT, null)).toBeNull();
		expect(resolveDefaultModel(LAST_USED_DEFAULT, gpt)).toEqual(gpt);
	});

	it("is the fixed model when one is set, whatever was picked last", () => {
		expect(resolveDefaultModel({ mode: "fixed", choice: opus }, gpt)).toEqual(
			opus,
		);
		expect(resolveDefaultModel({ mode: "fixed", choice: opus }, null)).toEqual(
			opus,
		);
	});

	it("falls back to the last pick when fixed has no model yet, or is switched back", () => {
		expect(resolveDefaultModel({ mode: "fixed" }, gpt)).toEqual(gpt);
		expect(
			resolveDefaultModel(
				{ mode: "fixed", choice: { provider: "openai", model: "" } },
				gpt,
			),
		).toEqual(gpt);
		expect(resolveDefaultModel({ mode: "last", choice: opus }, gpt)).toEqual(
			gpt,
		);
	});

	it("starts new chats on the fixed model read from this browser, not on the last pick", () => {
		storeChatModelChoice("chat-a", gpt);
		localStorage.setItem(
			DEFAULT_MODEL_STORAGE_KEY,
			JSON.stringify({ mode: "fixed", choice: opus }),
		);
		// A fresh module state would read storage; here the store was never read before, so it loads now.
		expect(readDefaultModelChoice()).toEqual(opus);
		expect(readChatModelChoice("new-chat")).toEqual(opus);
		// A chat with its own pick keeps it.
		expect(readChatModelChoice("chat-a")).toEqual(gpt);
	});
});
