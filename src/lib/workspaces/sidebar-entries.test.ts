import { describe, expect, it } from "vitest";
import type { ChatSummary } from "@/lib/storage/chat-store";
import { sidebarEntries } from "./sidebar-entries";

const chat = (id: string, updatedAt: number): ChatSummary => ({
	id,
	title: id,
	createdAt: 0,
	updatedAt,
	messageCount: 2,
	pinned: false,
	ownerId: null,
});

describe("sidebar entries", () => {
	it("folds a workspace's chats into one entry with its pane count", () => {
		const entries = sidebarEntries(
			[chat("solo", 5), chat("a", 1), chat("b", 9)],
			[
				{
					id: "w1",
					ownerId: null,
					chatIds: ["a", "b", "unsaved"],
					updatedAt: 3,
				},
			],
		);
		expect(entries).toEqual([
			{
				...chat("a", 9),
				workspace: { id: "w1", chatIds: ["a", "b", "unsaved"], paneCount: 3 },
			},
			chat("solo", 5),
		]);
	});

	it("leaves out a workspace with no saved chat, and gives a shared chat to the newer one", () => {
		const entries = sidebarEntries(
			[chat("a", 1)],
			[
				{ id: "empty", ownerId: null, chatIds: ["x"], updatedAt: 9 },
				{ id: "old", ownerId: null, chatIds: ["a"], updatedAt: 1 },
				{ id: "new", ownerId: null, chatIds: ["a"], updatedAt: 2 },
			],
		);
		expect(entries.map((entry) => entry.workspace?.id)).toEqual(["new"]);
	});
});
