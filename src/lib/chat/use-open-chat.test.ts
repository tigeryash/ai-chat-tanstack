// @vitest-environment jsdom
import type { Chat } from "@ai-sdk/react";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { UIMessage } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logError } from "@/lib/log";
import { addOpenChat, closeChat, type OpenChat } from "./open-chats";
import { useOpenChat } from "./use-open-chat";

vi.mock("@/lib/log", () => ({ logError: vi.fn() }));

// Quality audit Q2, W1: a route showing a saved chat that this tab has released reads it back from the
// store, and never shows (or creates) an empty chat under its id meanwhile.

function fakeChat(id: string): OpenChat {
	const chat = { id, status: "ready", stop: async () => {} };
	return { chat: chat as unknown as Chat<UIMessage>, ownerId: null };
}

afterEach(() => {
	for (const id of ["shown", "released", "gone", "broken"]) closeChat(id);
	vi.mocked(logError).mockClear();
});

describe("useOpenChat", () => {
	it("returns an open chat without reading the store", () => {
		const open = fakeChat("shown");
		addOpenChat("shown", open);
		const reopen = vi.fn(async () => true);
		const { result } = renderHook(() => useOpenChat("shown", reopen));
		expect(result.current).toEqual({ status: "open", open });
		expect(reopen).not.toHaveBeenCalled();
	});

	it("reopens a released chat, opening meanwhile", async () => {
		const open = fakeChat("released");
		let finish = () => {};
		const reopen = vi.fn(
			(id: string) =>
				new Promise<boolean>((resolve) => {
					finish = () => {
						addOpenChat(id, open);
						resolve(true);
					};
				}),
		);
		const { result } = renderHook(() => useOpenChat("released", reopen));
		expect(result.current).toEqual({ status: "opening" });
		expect(reopen).toHaveBeenCalledWith("released");

		act(() => finish());
		await waitFor(() =>
			expect(result.current).toEqual({ status: "open", open }),
		);
		expect(reopen).toHaveBeenCalledTimes(1);
	});

	it("reopens a chat released while it's shown", async () => {
		addOpenChat("shown", fakeChat("shown"));
		const again = fakeChat("shown");
		const reopen = vi.fn(async (id: string) => {
			addOpenChat(id, again);
			return true;
		});
		const { result } = renderHook(() => useOpenChat("shown", reopen));
		act(() => closeChat("shown"));
		await waitFor(() =>
			expect(result.current).toEqual({ status: "open", open: again }),
		);
	});

	it("reports a chat that's gone, or that couldn't be read", async () => {
		const gone = renderHook(() => useOpenChat("gone", async () => false));
		await waitFor(() =>
			expect(gone.result.current).toEqual({ status: "missing" }),
		);

		const broken = renderHook(() =>
			useOpenChat("broken", async () => {
				throw new Error("store unavailable");
			}),
		);
		await waitFor(() =>
			expect(broken.result.current).toEqual({ status: "failed" }),
		);
		expect(logError).toHaveBeenCalledWith(
			"Couldn't open the chat:",
			expect.any(Error),
		);
	});
});
