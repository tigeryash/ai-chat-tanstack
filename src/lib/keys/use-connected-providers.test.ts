// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logError } from "@/lib/log";
import type { ProviderId } from "./providers";
import {
	reloadConnectedProviders,
	resetConnectedProviders,
	useConnectedProviders,
} from "./use-connected-providers";
import { type KeySummary, listProviderKeys } from "./vault";

vi.mock("@/lib/log", () => ({ logError: vi.fn() }));
vi.mock("./vault", () => ({ listProviderKeys: vi.fn() }));

// A stand-in for key-events, so a test can say "a key changed" without a BroadcastChannel.
const keyListeners = vi.hoisted(() => new Set<() => void>());
vi.mock("./key-events", () => ({
	onKeysChanged: (listener: () => void) => {
		keyListeners.add(listener);
		return () => keyListeners.delete(listener);
	},
}));
const keysChanged = () => {
	for (const listener of keyListeners) listener();
};

let saved: ProviderId[] = [];
const list = vi.mocked(listProviderKeys);

beforeEach(() => {
	saved = [];
	list.mockImplementation(async () =>
		saved.map(
			(providerId): KeySummary => ({
				providerId,
				last4: "abcd",
				mode: "remember",
				source: "manual",
				savedAt: 0,
			}),
		),
	);
});

afterEach(() => {
	resetConnectedProviders();
	list.mockReset();
	vi.mocked(logError).mockClear();
});

const mount = () => renderHook(() => useConnectedProviders());

describe("useConnectedProviders", () => {
	it("is null until the first read, then lists providers with a key", async () => {
		saved = ["openai"];
		const { result, unmount } = mount();
		expect(result.current).toBeNull();

		await waitFor(() => expect(result.current).toEqual(new Set(["openai"])));
		unmount();
	});

	it("re-reads when a key is saved or deleted", async () => {
		const { result, unmount } = mount();
		await waitFor(() => expect(result.current).toEqual(new Set()));

		saved = ["anthropic"];
		act(keysChanged);
		await waitFor(() => expect(result.current).toEqual(new Set(["anthropic"])));
		unmount();
	});

	it("re-reads when the tab comes back into view", async () => {
		const { result, unmount } = mount();
		await waitFor(() => expect(result.current).toEqual(new Set()));

		saved = ["google"];
		act(() => {
			document.dispatchEvent(new Event("visibilitychange"));
		});
		await waitFor(() => expect(result.current).toEqual(new Set(["google"])));
		unmount();
	});

	// The bug fixed in PR #40: a key saved while no picker was mounted (in Settings) went unseen.
	it("re-reads for the first subscriber after a key changed while nobody listened", async () => {
		const first = mount();
		await waitFor(() => expect(first.result.current).toEqual(new Set()));
		first.unmount();

		saved = ["openrouter"];
		keysChanged();
		expect(keyListeners.size).toBe(0);

		const second = mount();
		await waitFor(() =>
			expect(second.result.current).toEqual(new Set(["openrouter"])),
		);
		second.unmount();
	});

	it("keeps the same set while the providers don't change", async () => {
		saved = ["openai"];
		const { result, unmount } = mount();
		await waitFor(() => expect(result.current).not.toBeNull());
		const before = result.current;

		await act(() => reloadConnectedProviders());
		expect(result.current).toBe(before);
		unmount();
	});

	it("reads an empty set when the keys can't be read", async () => {
		list.mockRejectedValue(new Error("IndexedDB blocked"));
		const { result, unmount } = mount();

		await waitFor(() => expect(result.current).toEqual(new Set()));
		expect(logError).toHaveBeenCalledWith(
			"Couldn't read saved API keys:",
			expect.any(Error),
		);
		unmount();
	});
});

describe("reloadConnectedProviders", () => {
	it("coalesces overlapping calls into one more read", async () => {
		const first = reloadConnectedProviders();
		void reloadConnectedProviders();
		void reloadConnectedProviders();
		await first;
		await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
	});
});
