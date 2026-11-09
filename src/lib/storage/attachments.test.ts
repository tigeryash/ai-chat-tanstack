import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
	ATTACHMENT_URL_PREFIX,
	bytesToDataUrl,
	dataUrlToBytes,
	dehydrateAttachments,
	hydrateAttachments,
} from "./attachments";
import { EMPTY_BRANCHES, editAt } from "./branches";
import { createDexieChatStore } from "./dexie-chat-store";
import { exportChats, importChats } from "./export";
import { openTestDatabase, textMessage, tickingClock } from "./test-support";

// A 1×1 PNG, as the composer sends it.
const PNG =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==";
const PDF = "data:application/pdf;base64,JVBERi0xLjQK";

function withFiles(id: string, ...urls: string[]): UIMessage {
	return {
		id,
		role: "user",
		parts: [
			...urls.map((url, i) => ({
				type: "file" as const,
				mediaType: url.slice(5, url.indexOf(";")),
				filename: `file-${i}`,
				url,
			})),
			{ type: "text", text: "Look" },
		],
	};
}

function setup() {
	const db = openTestDatabase();
	return { db, store: createDexieChatStore({ db, now: tickingClock() }) };
}

describe("data URLs", () => {
	it("round-trip through bytes", () => {
		const file = dataUrlToBytes(PNG);
		expect(file?.mediaType).toBe("image/png");
		expect(file && bytesToDataUrl(file.mediaType, file.bytes)).toBe(PNG);
		expect(dataUrlToBytes("data:text/plain,hi%20there")?.bytes).toEqual(
			new TextEncoder().encode("hi there"),
		);
		expect(dataUrlToBytes("https://example.com/a.png")).toBeUndefined();
	});
});

describe("dehydrate and hydrate", () => {
	it("moves file bytes out of messages and back, dropping files that are gone", () => {
		const messages = [
			withFiles("m1", PNG, PDF),
			textMessage("m2", "assistant", "ok"),
		];
		const stored = dehydrateAttachments("c1", messages);

		expect(stored.rows.map((row) => row.id)).toEqual(["c1/m1/0", "c1/m1/1"]);
		expect(JSON.stringify(stored.messages)).not.toContain("base64");
		expect(stored.messages[0].parts[0]).toMatchObject({
			url: `${ATTACHMENT_URL_PREFIX}c1/m1/0`,
		});
		expect(
			hydrateAttachments({ messages: stored.messages }, stored.rows),
		).toEqual({
			messages,
		});
		// The PDF's row is missing: its part goes, the rest stays.
		const partial = hydrateAttachments(
			{ messages: stored.messages },
			stored.rows.slice(0, 1),
		);
		expect(partial.messages[0].parts.map((part) => part.type)).toEqual([
			"file",
			"text",
		]);
	});
});

describe("DexieChatStore attachments", () => {
	it("stores files as bytes in their own table and gives them back as data URLs", async () => {
		const { db, store } = setup();
		const messages = [
			withFiles("m1", PNG),
			textMessage("m2", "assistant", "ok"),
		];
		await store.saveMessages("c1", messages, null);

		const [row] = await db.attachments.toArray();
		expect(row).toMatchObject({
			id: "c1/m1/0",
			chatId: "c1",
			mediaType: "image/png",
		});
		expect(row?.bytes).toBeInstanceOf(Uint8Array);
		const [stored] = await db.messages.toArray();
		expect(JSON.stringify(stored?.message)).not.toContain("base64");

		expect((await store.getChat("c1"))?.messages).toEqual(messages);
	});

	it("keeps files the chat still points to, including in branches, and deletes the rest", async () => {
		const { db, store } = setup();
		const first = [withFiles("m1", PNG), textMessage("m2", "assistant", "ok")];
		await store.saveMessages("c1", first, null);
		// Saving again (the next reply) doesn't duplicate the file.
		await store.saveMessages(
			"c1",
			[...first, withFiles("m3", PDF), textMessage("m4", "assistant", "ok")],
			null,
		);
		expect(await db.attachments.count()).toBe(2);

		// Editing m1 moves it (and its file) into a branch: still stored.
		const edit = editAt(
			first,
			EMPTY_BRANCHES,
			0,
			textMessage("m1b", "user", "hey"),
		);
		await store.saveMessages("c1", edit.path, null, edit.branches);
		expect((await db.attachments.toArray()).map((row) => row.id)).toEqual([
			"c1/m1/0",
		]);
		const reread = await store.getChat("c1");
		expect(reread?.branches?.messages[0]?.message).toEqual(first[0]);

		await store.deleteChat("c1");
		expect(await db.attachments.count()).toBe(0);
	});

	it("exports files inline and imports them back into the table", async () => {
		const { store } = setup();
		const messages = [withFiles("m1", PNG)];
		await store.saveMessages("c1", messages, null);
		const exported = await exportChats(store, null);
		expect(exported.json).toContain(PNG);

		const other = setup();
		await importChats(other.store, exported.json, null);
		expect(await other.db.attachments.count()).toBe(1);
		expect((await other.store.getChat("c1"))?.messages).toEqual(messages);
	});
});
