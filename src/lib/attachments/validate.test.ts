import { describe, expect, it } from "vitest";
import {
	checkAttachments,
	MAX_ATTACHMENTS,
	supportFromModalities,
} from "./validate";

const file = (name: string, type: string, size = 1) => {
	const made = new File(["x"], name, { type });
	Object.defineProperty(made, "size", { value: size });
	return made;
};
const png = (name = "a.png") => file(name, "image/png");
const pdf = file("doc.pdf", "application/pdf");

describe("checkAttachments", () => {
	it("accepts images and PDFs", () => {
		const selected = [png(), file("b.jpg", "image/jpeg"), pdf];
		expect(checkAttachments(selected)).toEqual({
			accepted: selected,
			errors: [],
		});
	});

	it("refuses other types and big files, each with its own reason", () => {
		const result = checkAttachments([
			file("app.exe", "application/x-msdownload"),
			file("song.mp3", "audio/mpeg"),
			file("big.png", "image/png", 21 * 1024 * 1024),
			file("big.csv", "text/csv", 2 * 1024 * 1024),
			png("ok.png"),
		]);
		expect(result.accepted.map((f) => f.name)).toEqual(["ok.png"]);
		expect(result.errors).toEqual([
			"app.exe can't be attached. Attach images (PNG, JPEG, WebP, GIF), PDFs, or text and code files.",
			"song.mp3 can't be attached. Attach images (PNG, JPEG, WebP, GIF), PDFs, or text and code files.",
			"big.png is larger than 20 MB.",
			"big.csv is larger than 1 MB, the limit for text files.",
		]);
	});

	it("accepts text and code files by type or extension, whatever the model reads (1.6b)", () => {
		const selected = [
			file("notes.txt", "text/plain"),
			file("data.json", "application/json"),
			file("main.ts", "video/mp2t"),
			file("app.py", ""),
			file("Dockerfile", ""),
		];
		const textOnly = supportFromModalities(["text"]);
		expect(checkAttachments(selected, { support: textOnly })).toEqual({
			accepted: selected,
			errors: [],
		});
	});

	it("keeps to the per-message count, counting what's already attached", () => {
		const many = Array.from({ length: 4 }, (_, i) => png(`${i}.png`));
		const result = checkAttachments(many, { attached: MAX_ATTACHMENTS - 2 });
		expect(result.accepted.map((f) => f.name)).toEqual(["0.png", "1.png"]);
		expect(result.errors).toEqual([
			`You can attach up to ${MAX_ATTACHMENTS} files per message.`,
		]);
	});

	it("refuses what the model can't read, and allows everything when that's unknown", () => {
		const textOnly = supportFromModalities(["text"]);
		expect(
			checkAttachments([png(), pdf], { support: textOnly }).errors,
		).toEqual([
			"This model can't read images, so a.png wasn't attached.",
			"This model can't read PDFs, so doc.pdf wasn't attached.",
		]);
		const vision = supportFromModalities(["text", "image"]);
		expect(
			checkAttachments([png(), pdf], { support: vision }).accepted,
		).toEqual([expect.objectContaining({ name: "a.png" })]);
		expect(supportFromModalities(undefined)).toBeUndefined();
		expect(checkAttachments([png(), pdf]).accepted).toHaveLength(2);
	});
});
