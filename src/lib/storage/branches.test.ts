import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
	type ChatBranches,
	EMPTY_BRANCHES,
	editAt,
	normalizeBranches,
	siblingsAt,
	switchAt,
} from "./branches";
import { textMessage } from "./test-support";

const ids = (path: readonly UIMessage[]) => path.map((message) => message.id);

const u1 = textMessage("u1", "user", "first");
const a1 = textMessage("a1", "assistant", "reply 1");
const u2 = textMessage("u2", "user", "second");
const a2 = textMessage("a2", "assistant", "reply 2");
const path = [u1, a1, u2, a2];

/** Edits `path[index]` into `id` and gives the edit the reply `reply`. */
function editWithReply(
	current: readonly UIMessage[],
	branches: ChatBranches,
	index: number,
	id: string,
) {
	const next = editAt(current, branches, index, textMessage(id, "user", id));
	return {
		path: [...next.path, textMessage(`${id}-reply`, "assistant", "r")],
		branches: next.branches,
	};
}

describe("branch tree", () => {
	it("has no siblings before an edit", () => {
		expect(siblingsAt(path, EMPTY_BRANCHES, 2)).toBeUndefined();
	});

	it("an edit cuts the path at the edited message and keeps the old one as a sibling", () => {
		const edited = textMessage("u2b", "user", "second, better");
		const next = editAt(path, EMPTY_BRANCHES, 2, edited);
		expect(ids(next.path)).toEqual(["u1", "a1", "u2b"]);
		expect(next.branches.forks).toEqual([
			{ parentId: "a1", childIds: ["u2", "u2b"], activeId: "u2b" },
		]);
		expect(next.branches.messages).toEqual([
			{ parentId: "a1", message: u2 },
			{ parentId: "u2", message: a2 },
		]);
		expect(siblingsAt(next.path, next.branches, 2)).toEqual({
			ids: ["u2", "u2b"],
			index: 1,
		});
	});

	it("editing the first message forks before it", () => {
		const next = editAt(
			path,
			EMPTY_BRANCHES,
			0,
			textMessage("u1b", "user", "x"),
		);
		expect(ids(next.path)).toEqual(["u1b"]);
		expect(next.branches.forks[0]).toMatchObject({ parentId: null });
		expect(siblingsAt(next.path, next.branches, 0)?.ids).toEqual(["u1", "u1b"]);
	});

	it("switching back restores the original branch, replies and all", () => {
		const edited = editWithReply(path, EMPTY_BRANCHES, 2, "u2b");
		const back = switchAt(edited.path, edited.branches, 2, "u2");
		expect(back.path).toEqual(path);
		expect(siblingsAt(back.path, back.branches, 2)).toEqual({
			ids: ["u2", "u2b"],
			index: 0,
		});
		const forward = switchAt(back.path, back.branches, 2, "u2b");
		expect(forward).toEqual({
			path: edited.path,
			branches: {
				...edited.branches,
				messages: expect.arrayContaining(edited.branches.messages),
			},
		});
	});

	it("a third version joins the same fork", () => {
		const two = editWithReply(path, EMPTY_BRANCHES, 2, "u2b");
		const three = editWithReply(two.path, two.branches, 2, "u2c");
		expect(three.branches.forks).toEqual([
			{ parentId: "a1", childIds: ["u2", "u2b", "u2c"], activeId: "u2c" },
		]);
	});

	it("a branch remembers the version shown inside it", () => {
		// Edit u2, then edit u1: the u1 branch was showing u2b. Going back to u1 shows u2b again.
		const inner = editWithReply(path, EMPTY_BRANCHES, 2, "u2b");
		const outer = editWithReply(inner.path, inner.branches, 0, "u1b");
		const back = switchAt(outer.path, outer.branches, 0, "u1");
		expect(ids(back.path)).toEqual(["u1", "a1", "u2b", "u2b-reply"]);
		expect(siblingsAt(back.path, back.branches, 0)?.index).toBe(0);
		expect(siblingsAt(back.path, back.branches, 2)?.index).toBe(1);
	});

	it("refuses to switch to a message that isn't a version", () => {
		const edited = editWithReply(path, EMPTY_BRANCHES, 2, "u2b");
		expect(() => switchAt(edited.path, edited.branches, 2, "a2")).toThrow(
			RangeError,
		);
	});

	it("normalizing drops what the path no longer reaches", () => {
		const edited = editWithReply(path, EMPTY_BRANCHES, 2, "u2b");
		// Messages after the fork's parent were replaced (another tab, an import): nothing reaches it.
		const elsewhere = [u1, textMessage("other", "assistant", "x")];
		expect(normalizeBranches(elsewhere, edited.branches)).toEqual(
			EMPTY_BRANCHES,
		);
		// Unchanged when everything is reachable.
		expect(normalizeBranches(edited.path, edited.branches)).toEqual(
			edited.branches,
		);
	});

	it("normalizing points a fork on the path at the path's message", () => {
		const edited = editWithReply(path, EMPTY_BRANCHES, 2, "u2b");
		const stale = {
			...edited.branches,
			forks: [{ ...edited.branches.forks[0], activeId: "u2" }],
		} as ChatBranches;
		expect(normalizeBranches(edited.path, stale).forks[0]?.activeId).toBe(
			"u2b",
		);
	});
});
