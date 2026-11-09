import { describe, expect, it } from "vitest";
import {
	canRead,
	planPaneSend,
	unreadableFiles,
	unreadableNotice,
} from "./capability";

const TEXT_ONLY = { images: false, pdfs: false };
const IMAGES_ONLY = { images: true, pdfs: false };
const png = { name: "red.png", mediaType: "image/png" };
const pdf = { name: "report.pdf", mediaType: "application/pdf" };
const notes = { name: "notes.md", mediaType: "text/markdown" };

describe("canRead", () => {
	it("leaves an unknown model (local, custom, catalog not loaded) to its provider", () => {
		expect(canRead(undefined, "image/png")).toBe(true);
		expect(canRead(undefined, "application/pdf")).toBe(true);
	});

	it("checks images and PDFs against what the model reads", () => {
		expect(canRead(TEXT_ONLY, "image/png")).toBe(false);
		expect(canRead(IMAGES_ONLY, "image/webp")).toBe(true);
		expect(canRead(IMAGES_ONLY, "application/pdf")).toBe(false);
	});

	it("never refuses a text or code file: every model reads text", () => {
		expect(canRead(TEXT_ONLY, "text/markdown")).toBe(true);
		expect(canRead(TEXT_ONLY, "application/json")).toBe(true);
		expect(canRead(TEXT_ONLY, "video/mp2t")).toBe(true);
		expect(canRead(TEXT_ONLY, "")).toBe(true);
	});
});

describe("unreadableFiles", () => {
	it("lists the files the pane's model can't read, in order", () => {
		expect(unreadableFiles([png, notes, pdf], IMAGES_ONLY)).toEqual([pdf]);
		expect(unreadableFiles([png, notes, pdf], TEXT_ONLY)).toEqual([png, pdf]);
		expect(unreadableFiles([png, pdf], undefined)).toEqual([]);
	});
});

describe("planPaneSend", () => {
	it("sends every file to a model that reads them", () => {
		expect(
			planPaneSend("Look", [png, pdf], {
				support: { images: true, pdfs: true },
				skip: false,
			}),
		).toEqual({ send: true, files: [png, pdf] });
	});

	it("sends text only (and the files it reads) by default", () => {
		expect(
			planPaneSend("Look", [png, notes], { support: TEXT_ONLY, skip: false }),
		).toEqual({ send: true, files: [notes] });
	});

	it("sends nothing to a pane its person skipped", () => {
		expect(
			planPaneSend("Look", [png], { support: TEXT_ONLY, skip: true }),
		).toEqual({ send: false, reason: "skipped" });
	});

	it("ignores a skip once the pane's model reads every file", () => {
		expect(
			planPaneSend("Look", [png], { support: IMAGES_ONLY, skip: true }),
		).toEqual({ send: true, files: [png] });
		expect(
			planPaneSend("Look", [], { support: TEXT_ONLY, skip: true }),
		).toEqual({ send: true, files: [] });
	});

	it("doesn't send a message left with no text and no files", () => {
		expect(
			planPaneSend(" ", [png], { support: TEXT_ONLY, skip: false }),
		).toEqual({ send: false, reason: "empty" });
	});
});

describe("unreadableNotice", () => {
	it("names the files and says what the pane will do", () => {
		expect(unreadableNotice([png], false)).toBe(
			"This model can't read red.png, so this pane gets the message without it.",
		);
		expect(unreadableNotice([png, pdf], false)).toBe(
			"This model can't read red.png, report.pdf, so this pane gets the message without them.",
		);
		expect(unreadableNotice([png], true)).toBe(
			"This model can't read red.png, so this pane won't get the message.",
		);
	});
});
