// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createDexieChatStore } from "@/lib/storage/dexie-chat-store";
import { openTestDatabase } from "@/lib/storage/test-support";
import { BrowserChatTransport } from "./browser-transport";
import { openChat, openNewChat } from "./chat-sessions";
import { mockChatModel } from "./mock-model";
import { TITLE_MODEL_STORAGE_KEY } from "./title-model";

// The title model (roadmap R2 S2) names a new chat in the same write that first saves it.

const SELECTION = { provider: "local", model: "mock" } as const;
const transport = new BrowserChatTransport(async () =>
	mockChatModel({ text: ["Hi ", "there"] }),
);

async function savedChat(
	store: ReturnType<typeof createDexieChatStore>,
	id: string,
) {
	return vi.waitFor(async () => {
		const found = await store.getChat(id);
		if (!found) throw new Error("not saved yet");
		return found;
	});
}

describe("chat titles from the title model", () => {
	it("are written once, and saved with the chat's first write", async () => {
		localStorage.setItem(
			TITLE_MODEL_STORAGE_KEY,
			JSON.stringify({
				enabled: true,
				choice: { provider: "local", model: "titles" },
			}),
		);
		const store = createDexieChatStore({ db: openTestDatabase() });
		const saveMessages = vi.spyOn(store, "saveMessages");
		const resolveTitleModel = vi.fn(async () =>
			mockChatModel({ text: ["Greeting ", "the model"], chunkDelayInMs: 30 }),
		);
		const chat = openNewChat({
			transport,
			store,
			ownerId: null,
			resolveTitleModel,
		});

		await chat.sendMessage({ text: "hello there" }, { body: SELECTION });
		const saved = await savedChat(store, chat.id);
		expect(saved.title).toBe("Greeting the model");
		expect(saveMessages).toHaveBeenCalledTimes(1);

		await chat.sendMessage({ text: "and again" }, { body: SELECTION });
		await vi.waitFor(() => expect(saveMessages).toHaveBeenCalledTimes(2));
		expect(resolveTitleModel).toHaveBeenCalledTimes(1);
		expect((await store.getChat(chat.id))?.title).toBe("Greeting the model");
	});

	it("aren't asked for in a chat that was already saved", async () => {
		const store = createDexieChatStore({ db: openTestDatabase() });
		const resolveTitleModel = vi.fn();
		const chat = openChat("saved-elsewhere", {
			messages: [
				{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] },
			],
			transport,
			store,
			resolveTitleModel,
		});
		await chat.sendMessage({ text: "more" }, { body: SELECTION });
		await savedChat(store, chat.id);
		expect(resolveTitleModel).not.toHaveBeenCalled();
	});
});
