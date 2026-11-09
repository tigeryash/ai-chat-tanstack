// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { saveChat } from "@/lib/chat/chat-sessions";
import { chatSettingsOf, setChatSettings } from "@/lib/chat/chat-settings";
import { createDexieChatStore } from "@/lib/storage/dexie-chat-store";
import { openTestDatabase, textMessage } from "@/lib/storage/test-support";
import { copySettingsToPanes } from "./copy-settings";

describe("copy settings to all panes", () => {
	it("gives every other pane the source's settings and system prompt, saved or not", async () => {
		const store = createDexieChatStore({ db: openTestDatabase("copy-a") });
		await saveChat(store, "saved", [textMessage("m1", "user", "hi")], null);
		setChatSettings("saved", { params: { seed: 1 } }, store);
		const source = {
			params: { temperature: 0.2, stopSequences: ["END"] },
			systemPrompt: "Be brief.",
		};
		setChatSettings("source", source, store);

		expect(
			copySettingsToPanes("source", ["source", "saved", "unsaved"], store),
		).toBe(2);
		expect(chatSettingsOf("saved")).toEqual(source);
		expect(chatSettingsOf("unsaved")).toEqual(source);
		expect(chatSettingsOf("source")).toEqual(source);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect((await store.getChat("saved"))?.settings).toEqual(source);

		// The unsaved pane's chat gets them when its first reply saves it.
		await saveChat(store, "unsaved", [textMessage("m2", "user", "hi")], null);
		expect((await store.getChat("unsaved"))?.settings).toEqual(source);
	});

	it("a source on the shared system prompt puts the others on it too", () => {
		const store = createDexieChatStore({ db: openTestDatabase("copy-b") });
		setChatSettings("p1", { params: { topK: 3 } }, store);
		setChatSettings("p2", { params: {}, systemPrompt: "Old." }, store);
		copySettingsToPanes("p1", ["p1", "p2"], store);
		expect(chatSettingsOf("p2")).toEqual({ params: { topK: 3 } });
	});
});
