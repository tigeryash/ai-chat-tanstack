// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toFileObject, toFilePart } from "./file-object";
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

describe("useAttachments", () => {
	it("adds files through the shared check, reports refusals, then marks them processed", async () => {
		const onErrors = vi.fn();
		const { result } = renderHook(() => useAttachments({ onErrors }));

		await act(() => result.current.add([image(), new File(["x"], "app.exe")]));

		expect(result.current.files).toHaveLength(1);
		expect(onErrors).toHaveBeenCalledWith([
			"app.exe can't be attached. Attach images (PNG, JPEG, WebP, GIF) or PDFs.",
		]);
		await waitFor(() =>
			expect(result.current.files[0]?.isProcessing).toBe(false),
		);
		expect(await result.current.settled()).toEqual(result.current.files);
		expect(result.current.files[0].base64).toBe("data:;base64,");
		expect(toFilePart(result.current.files[0])).toEqual({
			type: "file",
			mediaType: "image/png",
			filename: "a.png",
			url: "data:;base64,",
		});
	});

	it("refuses files the model can't read", async () => {
		const onErrors = vi.fn();
		const { result } = renderHook(() =>
			useAttachments({ support: { images: false, pdfs: true }, onErrors }),
		);
		await act(() => result.current.add([image()]));
		expect(result.current.files).toEqual([]);
		expect(onErrors).toHaveBeenCalledWith([
			"This model can't read images, so a.png wasn't attached.",
		]);
	});

	it("clears every attachment and revokes their previews after a send", async () => {
		const { result } = renderHook(() => useAttachments());
		await act(() => result.current.add([image("a.png"), image("b.png")]));

		act(() => result.current.clear());

		expect(result.current.files).toEqual([]);
		expect(revokeObjectURL).toHaveBeenCalledTimes(2);
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
