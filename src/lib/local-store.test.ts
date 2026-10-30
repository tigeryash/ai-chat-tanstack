// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logWarn } from "@/lib/log";
import { z } from "@/lib/zod";
import { createLocalStore } from "./local-store";

vi.mock("@/lib/log", () => ({ logWarn: vi.fn() }));

const KEY = "test-store";
const schema = z.object({ count: z.number().int().min(0) });
const FALLBACK = { count: 0 };

const makeStore = () => createLocalStore(KEY, schema, FALLBACK);

afterEach(() => {
	localStorage.clear();
	vi.restoreAllMocks();
	vi.mocked(logWarn).mockClear();
});

describe("createLocalStore", () => {
	it("reads the fallback when nothing is stored", () => {
		expect(makeStore().read()).toEqual(FALLBACK);
	});

	it("reads a stored value that passes the schema", () => {
		localStorage.setItem(KEY, JSON.stringify({ count: 3 }));
		expect(makeStore().read()).toEqual({ count: 3 });
	});

	it.each([
		["broken JSON", "{count"],
		["a value the schema rejects", JSON.stringify({ count: -1 })],
		["an old shape", JSON.stringify({ total: 3 })],
	])("reads the fallback for %s", (_, raw) => {
		localStorage.setItem(KEY, raw);
		expect(makeStore().read()).toEqual(FALLBACK);
	});

	it("reads the fallback when storage is blocked", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new DOMException("blocked", "SecurityError");
		});
		expect(makeStore().read()).toEqual(FALLBACK);
	});

	it("reads storage once, then serves the cached value", () => {
		localStorage.setItem(KEY, JSON.stringify({ count: 2 }));
		const getItem = vi.spyOn(Storage.prototype, "getItem");
		const store = makeStore();
		store.read();
		store.read();
		expect(getItem).toHaveBeenCalledTimes(1);
	});

	it("saves a written value as JSON", () => {
		const store = makeStore();
		store.write({ count: 5 });
		expect(store.read()).toEqual({ count: 5 });
		expect(JSON.parse(localStorage.getItem(KEY) ?? "null")).toEqual({
			count: 5,
		});
	});

	it("refuses to write a value the schema rejects", () => {
		const store = makeStore();
		expect(() => store.write({ count: -1 })).toThrow();
		expect(store.read()).toEqual(FALLBACK);
		expect(localStorage.getItem(KEY)).toBeNull();
	});

	it("keeps a written value for this page when storage refuses it", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new DOMException("full", "QuotaExceededError");
		});
		const store = makeStore();
		store.write({ count: 4 });
		expect(store.read()).toEqual({ count: 4 });
		expect(logWarn).toHaveBeenCalledWith(
			`Couldn't save ${KEY}:`,
			expect.any(DOMException),
		);
	});

	it("re-renders every reader on write", () => {
		const store = makeStore();
		const first = renderHook(() => store.use());
		const second = renderHook(() => store.use());
		expect(first.result.current).toEqual(FALLBACK);

		act(() => store.write({ count: 7 }));
		expect(first.result.current).toEqual({ count: 7 });
		expect(second.result.current).toEqual({ count: 7 });
	});

	it("picks up a write from another tab", () => {
		const store = makeStore();
		const { result } = renderHook(() => store.use());

		localStorage.setItem(KEY, JSON.stringify({ count: 9 }));
		act(() => {
			window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
		});
		expect(result.current).toEqual(FALLBACK);

		act(() => {
			window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
		});
		expect(result.current).toEqual({ count: 9 });
	});

	it("stops listening to other tabs after unmount", () => {
		const store = makeStore();
		const { unmount } = renderHook(() => store.use());
		unmount();

		localStorage.setItem(KEY, JSON.stringify({ count: 9 }));
		window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
		expect(store.read()).toEqual(FALLBACK);
	});
});
