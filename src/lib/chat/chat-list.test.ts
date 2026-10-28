import { describe, expect, it } from "vitest";
import type { ChatSummary } from "@/lib/storage/chat-store";
import { arrangeChats } from "./chat-list";

function chat(id: string, updatedAt: number, extra: Partial<ChatSummary> = {}) {
	return {
		id,
		title: id,
		createdAt: 0,
		updatedAt,
		messageCount: 2,
		pinned: false,
		...extra,
	};
}

const ids = (chats: ChatSummary[]) => chats.map((entry) => entry.id);

describe("arrangeChats", () => {
	it("puts pinned chats first, each group newest first", () => {
		const { pinned, recent } = arrangeChats([
			chat("a", 1),
			chat("b", 3, { pinned: true }),
			chat("c", 2),
			chat("d", 4, { pinned: true }),
		]);
		expect(ids(pinned)).toEqual(["d", "b"]);
		expect(ids(recent)).toEqual(["c", "a"]);
	});

	it("searches titles, ignoring case, with untitled chats as New chat", () => {
		const { pinned, recent } = arrangeChats(
			[
				chat("1", 1, { title: "Trip to Lisbon" }),
				chat("2", 2, { title: "Tax questions", pinned: true }),
				chat("3", 3, { title: "" }),
			],
			"  t",
		);
		expect(ids(pinned)).toEqual(["2"]);
		expect(ids(recent)).toEqual(["3", "1"]);
		expect(
			ids(arrangeChats([chat("1", 1, { title: "Trip" })], "LIS").recent),
		).toEqual([]);
		expect(
			ids(arrangeChats([chat("3", 3, { title: "" })], "new").recent),
		).toEqual(["3"]);
	});
});
