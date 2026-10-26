import { describe, expect, it, vi } from "vitest";
import { getStorageStatus, requestPersistentStorage } from "./persistence";

function fakeStorage({
	persisted = false,
	grant = true,
}: {
	persisted?: boolean;
	grant?: boolean;
} = {}) {
	return {
		persisted: vi.fn(async () => persisted),
		persist: vi.fn(async () => grant),
		estimate: vi.fn(async () => ({ usage: 1_024, quota: 1_048_576 })),
	};
}

describe("requestPersistentStorage", () => {
	it("asks the browser and reports its answer", async () => {
		expect(await requestPersistentStorage(fakeStorage({ grant: true }))).toBe(
			"persisted",
		);
		expect(await requestPersistentStorage(fakeStorage({ grant: false }))).toBe(
			"not-persisted",
		);
	});

	it("doesn't ask again once storage is persistent", async () => {
		const storage = fakeStorage({ persisted: true });
		expect(await requestPersistentStorage(storage)).toBe("persisted");
		expect(storage.persist).not.toHaveBeenCalled();
	});

	it("reports browsers without the API", async () => {
		expect(await requestPersistentStorage(undefined)).toBe("unsupported");
		expect(await requestPersistentStorage({})).toBe("unsupported");
	});

	it("treats a failed request as not persisted instead of throwing", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const storage = {
			...fakeStorage(),
			persist: async () => {
				throw new DOMException("denied", "InvalidStateError");
			},
		};
		expect(await requestPersistentStorage(storage)).toBe("not-persisted");
		warn.mockRestore();
	});
});

describe("getStorageStatus", () => {
	it("reports persistence and usage", async () => {
		expect(await getStorageStatus(fakeStorage({ persisted: true }))).toEqual({
			persistence: "persisted",
			usageBytes: 1_024,
			quotaBytes: 1_048_576,
		});
	});

	it("works when the browser has no storage API", async () => {
		expect(await getStorageStatus(undefined)).toEqual({
			persistence: "unsupported",
			usageBytes: null,
			quotaBytes: null,
		});
	});
});
