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
			null,
		);
		expect(entries).toEqual([
			{
				...chat("a", 9),
				workspace: { id: "w1", paneCount: 3 },
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
			null,
		);
		expect(entries.map((entry) => entry.workspace?.id)).toEqual(["new"]);
	});

	it("counts and leads with only the chats the viewer can see, and hides others' workspaces", () => {
		const theirs = { ...chat("theirs", 9), ownerId: "user-b" };
		const entries = sidebarEntries(
			[theirs, chat("mine", 1), { ...chat("b-solo", 5), ownerId: "user-b" }],
			[
				{
					id: "shared",
					ownerId: null,
					chatIds: ["theirs", "mine", "unsaved"],
					updatedAt: 3,
				},
				{ id: "b-only", ownerId: "user-b", chatIds: ["b-solo"], updatedAt: 4 },
			],
			null,
		);
		expect(entries).toEqual([
			{ ...chat("mine", 1), workspace: { id: "shared", paneCount: 2 } },
		]);
	});
});
