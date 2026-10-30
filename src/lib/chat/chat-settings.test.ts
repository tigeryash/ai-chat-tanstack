// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createDexieChatStore } from "@/lib/storage/dexie-chat-store";
import { openTestDatabase, textMessage } from "@/lib/storage/test-support";
import { saveChat } from "./chat-sessions";
import {
	chatSettingsOf,
	effectiveChatSettings,
	loadChatSettings,
	modelKey,
	pinChatSettings,
	setChatSettings,
} from "./chat-settings";

const OPUS = modelKey({
	provider: "openrouter",
	model: "anthropic/claude-opus-5.5",
	gatewayId: "anthropic/claude-opus-5.5",
});
const LOCAL = modelKey({ provider: "local", model: "qwen" });

describe("chat settings", () => {
	it("keys last-used settings by catalog model, else provider and model", () => {
		expect(OPUS).toBe("anthropic/claude-opus-5.5");
		expect(LOCAL).toBe("local:qwen");
		expect(modelKey({ provider: "openai", model: "" })).toBeUndefined();
	});

	it("starts a new chat with the last settings used with its model", () => {
		const store = createDexieChatStore({ db: openTestDatabase("settings-a") });
		setChatSettings("a1", { params: { temperature: 0.3 } }, store, OPUS);

		expect(effectiveChatSettings("fresh", OPUS)).toEqual({
			params: { temperature: 0.3 },
		});
		expect(effectiveChatSettings("fresh", LOCAL)).toEqual({ params: {} });
		expect(chatSettingsOf("fresh")).toBeUndefined();
	});

	it("pins the settings a chat was sent with, and saves them with its first reply", async () => {
		const store = createDexieChatStore({ db: openTestDatabase("settings-b") });
		setChatSettings("b0", { params: { seed: 5 } }, store, LOCAL);
		pinChatSettings("b1", LOCAL, store);
		// Later changes to the model's default don't reach the pinned chat.
		setChatSettings("b2", { params: { seed: 9 } }, store, LOCAL);
		expect(chatSettingsOf("b1")).toEqual({ params: { seed: 5 } });

		await saveChat(store, "b1", [textMessage("m1", "user", "hi")], null);
		expect((await store.getChat("b1"))?.settings).toEqual({
			params: { seed: 5 },
		});
	});

	it("loads a saved chat's settings without overwriting newer ones in this tab", () => {
		loadChatSettings("c1", { params: { topK: 3 } });
		loadChatSettings("c1", { params: { topK: 4 } });
		expect(chatSettingsOf("c1")).toEqual({ params: { topK: 3 } });
	});
});
