import { describe, expect, it, vi } from "vitest";
import { BrowserChatTransport, SEND_CODE_FAILED } from "./browser-transport";

// The send code loads with `import()` on the first send (perf/trim-new-route). When that download fails,
// the chat shows a readable message, not the browser's "Failed to fetch dynamically imported module: <url>".
vi.mock("./stream-reply", () => {
	throw new TypeError("Failed to fetch dynamically imported module");
});
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));

describe("BrowserChatTransport when the send code doesn't load", () => {
	it("rejects with a message the chat can show", async () => {
		const send = new BrowserChatTransport().sendMessages({
			trigger: "submit-message",
			chatId: "c1",
			messageId: undefined,
			messages: [],
			abortSignal: undefined,
			body: undefined,
		});
		await expect(send).rejects.toThrow(SEND_CODE_FAILED);
	});
});
