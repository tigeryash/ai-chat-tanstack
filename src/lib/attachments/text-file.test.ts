import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
	AttachmentRefusal,
	isTextFile,
	readTextFile,
	TEXT_FILE_ACCEPT,
	textFilePrompt,
	textFilesAsText,
} from "./text-file";

describe("isTextFile", () => {
	it("goes by type, then by extension or name", () => {
		expect(isTextFile({ name: "a", type: "text/markdown" })).toBe(true);
		expect(isTextFile({ name: "a", type: "application/x-yaml" })).toBe(true);
		expect(
			isTextFile({ name: "a", type: "application/json; charset=utf-8" }),
		).toBe(true);
		expect(isTextFile({ name: "main.TS", type: "video/mp2t" })).toBe(true);
		expect(isTextFile({ name: "lib.rs", type: "" })).toBe(true);
		expect(isTextFile({ name: "Makefile", type: "" })).toBe(true);
		expect(isTextFile({ name: "song.mp3", type: "audio/mpeg" })).toBe(false);
		expect(isTextFile({ name: "app", type: "" })).toBe(false);
		expect(isTextFile({ name: "logo.svg", type: "image/svg+xml" })).toBe(false);
	});

	it("lists types and extensions for the picker", () => {
		expect(TEXT_FILE_ACCEPT.split(",")).toEqual(
			expect.arrayContaining(["text/*", "application/json", ".ts", ".yaml"]),
		);
	});
});

describe("readTextFile", () => {
	it("gives a UTF-8 file back with a text type", async () => {
		const read = await readTextFile(new File(["héllo"], "a.py", { type: "" }));
		expect(read.type).toBe("text/plain");
		expect(read.name).toBe("a.py");
		expect(await read.text()).toBe("héllo");
		const json = await readTextFile(
			new File(["{}"], "a.json", { type: "application/json" }),
		);
		expect(json.type).toBe("application/json");
	});

	it("refuses binary, without quoting it", async () => {
		const binary = new File(
			[new Uint8Array([0xff, 0xfe, 0x00, 0x81])],
			"x.txt",
		);
		await expect(readTextFile(binary)).rejects.toEqual(
			new AttachmentRefusal(
				"x.txt isn't a UTF-8 text file, so it wasn't attached.",
			),
		);
		const nul = new File([new Uint8Array([0x61, 0x00, 0x62])], "y.txt");
		await expect(readTextFile(nul)).rejects.toBeInstanceOf(AttachmentRefusal);
	});
});

describe("textFilePrompt", () => {
	it("names the file and fences its content with a language hint", () => {
		expect(textFilePrompt("main.py", "print(1)")).toBe(
			"File: main.py\n```python\nprint(1)\n```",
		);
		expect(textFilePrompt("notes", "hi")).toBe("File: notes\n```\nhi\n```");
	});

	it("uses a fence longer than any backticks inside, and keeps the name on one line", () => {
		expect(textFilePrompt("a\nb.md", "x ```` y")).toBe(
			"File: a b.md\n`````markdown\nx ```` y\n`````",
		);
	});
});

describe("textFilesAsText", () => {
	it("turns text file parts into text parts and leaves other parts alone", () => {
		const image = {
			type: "file" as const,
			mediaType: "image/png",
			filename: "a.png",
			url: "data:image/png;base64,iVBORw0KGgo=",
		};
		const messages: UIMessage[] = [
			{
				id: "u1",
				role: "user",
				parts: [
					image,
					{
						type: "file",
						mediaType: "text/plain",
						filename: "notes.txt",
						url: `data:text/plain;base64,${btoa("hi")}`,
					},
					{ type: "text", text: "Summarise" },
				],
			},
			{ id: "a1", role: "assistant", parts: [{ type: "text", text: "ok" }] },
		];
		const [user, reply] = textFilesAsText(messages);
		expect(user?.parts).toEqual([
			image,
			{ type: "text", text: "File: notes.txt\n```text\nhi\n```" },
			{ type: "text", text: "Summarise" },
		]);
		expect(reply).toBe(messages[1]);
	});
});
