// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAllowedFile, toFileObject } from "./file-object";
import { useAttachments } from "./use-attachments";

vi.mock("./process", () => ({
	processAttachment: async (file: File) => ({
		file,
		base64: "data:;base64,",
	}),
}));

let created = 0;
const revokeObjectURL = vi.fn();

beforeEach(() => {
	created = 0;
	URL.createObjectURL = vi.fn(() => `blob:test/${++created}`);
	URL.revokeObjectURL = revokeObjectURL;
});

afterEach(() => {
	revokeObjectURL.mockClear();
});

const image = (name = "a.png") => new File(["x"], name, { type: "image/png" });

describe("toFileObject", () => {
	it("gives each file a UUID and previews only images", () => {
		const a = toFileObject(image());
		const b = toFileObject(
			new File(["x"], "notes.txt", { type: "text/plain" }),
		);

		expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(a.id).not.toBe(b.id);
		expect(a.preview).toMatch(/^blob:/);
		expect(b.preview).toBe("");
		expect(a.isProcessing).toBe(true);
	});
});

describe("isAllowedFile", () => {
	it("accepts listed types and source files, rejects others and big files", () => {
		expect(isAllowedFile(image())).toBe(true);
		expect(isAllowedFile(new File(["x"], "main.py"))).toBe(true);
		expect(isAllowedFile(new File(["x"], "app.exe"))).toBe(false);
		const big = new File(["x"], "big.png", { type: "image/png" });
		Object.defineProperty(big, "size", { value: 21 * 1024 * 1024 });
		expect(isAllowedFile(big)).toBe(false);
	});
});

describe("useAttachments", () => {
	it("adds files, then marks them processed", async () => {
		const { result } = renderHook(() => useAttachments());

		await act(() => result.current.add([image(), new File(["x"], "app.exe")]));

		expect(result.current.files).toHaveLength(1);
		await waitFor(() =>
			expect(result.current.files[0].isProcessing).toBe(false),
		);
		expect(result.current.files[0].base64).toBe("data:;base64,");
	});

	it("revokes a preview when its file is removed", async () => {
		const { result } = renderHook(() => useAttachments());
		await act(() => result.current.add([image()]));
		const { id, preview } = result.current.files[0];

		act(() => result.current.remove(id));

		expect(result.current.files).toEqual([]);
		expect(revokeObjectURL).toHaveBeenCalledWith(preview);
	});

	it("revokes the remaining previews on unmount", async () => {
		const { result, unmount } = renderHook(() => useAttachments());
		await act(() => result.current.add([image("a.png"), image("b.png")]));

		unmount();

		expect(revokeObjectURL.mock.calls.map(([url]) => url).sort()).toEqual([
			"blob:test/1",
			"blob:test/2",
		]);
	});
});
