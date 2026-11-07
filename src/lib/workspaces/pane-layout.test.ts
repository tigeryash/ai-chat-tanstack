import { describe, expect, it } from "vitest";
import type { WorkspacePane } from "@/lib/storage/workspace";
import {
	addPane,
	canAddPane,
	initialPanes,
	layoutOf,
	movePane,
	removeChats,
	removePane,
	resizePanes,
	setPaneSynced,
	splitHiddenPanes,
	withHiddenPanes,
} from "./pane-layout";

const ids = (panes: readonly WorkspacePane[]) => panes.map((p) => p.chatId);
const total = (panes: readonly WorkspacePane[]) =>
	Math.round(panes.reduce((sum, pane) => sum + pane.size, 0) * 100) / 100;

describe("pane layout", () => {
	it("starts synced, in equal widths that add up to 100", () => {
		const panes = initialPanes(["a", "b", "c"]);
		expect(panes).toEqual([
			{ chatId: "a", size: 33.33, synced: true },
			{ chatId: "b", size: 33.33, synced: true },
			{ chatId: "c", size: 33.34, synced: true },
		]);
		expect(layoutOf(panes)).toEqual({ a: 33.33, b: 33.33, c: 33.34 });
	});

	it("adds panes up to four, evening out the widths", () => {
		let panes = initialPanes(["a"]);
		for (const id of ["b", "c", "d", "e"]) panes = addPane(panes, id);
		expect(ids(panes)).toEqual(["a", "b", "c", "d"]);
		expect(panes.map((pane) => pane.size)).toEqual([25, 25, 25, 25]);
		expect(canAddPane(panes)).toBe(false);
		expect(ids(addPane(initialPanes(["a"]), "a"))).toEqual(["a"]);
	});

	it("removes a pane but never the last", () => {
		const panes = initialPanes(["a", "b", "c"]);
		const two = removePane(panes, "b");
		expect(ids(two)).toEqual(["a", "c"]);
		expect(total(two)).toBe(100);
		expect(ids(removePane(removePane(two, "a"), "c"))).toEqual(["c"]);
		expect(removePane(panes, "missing")).toEqual(panes);
	});

	it("moves a pane one place, keeping its width, and not past either end", () => {
		const panes = resizePanes(initialPanes(["a", "b", "c"]), { c: 50 });
		const moved = movePane(panes, "c", -1);
		expect(ids(moved)).toEqual(["a", "c", "b"]);
		expect(moved[1]?.size).toBe(50);
		expect(ids(movePane(panes, "a", -1))).toEqual(["a", "b", "c"]);
		expect(ids(movePane(panes, "c", 1))).toEqual(["a", "b", "c"]);
	});

	it("applies resized widths, ignoring unknown panes and bad numbers", () => {
		const panes = resizePanes(initialPanes(["a", "b"]), {
			a: 70,
			b: Number.NaN,
			z: 10,
		});
		expect(panes.map((pane) => pane.size)).toEqual([70, 50]);
	});

	it("turns sync off for one pane", () => {
		const panes = setPaneSynced(initialPanes(["a", "b"]), "b", false);
		expect(panes.map((pane) => pane.synced)).toEqual([true, false]);
	});

	it("counts hidden panes toward the limit", () => {
		const panes = initialPanes(["a", "b"]);
		expect(canAddPane(panes, 2)).toBe(false);
		expect(ids(addPane(panes, "c", 2))).toEqual(["a", "b"]);
		expect(ids(addPane(panes, "c", 1))).toEqual(["a", "b", "c"]);
	});

	it("removes several chats' panes, possibly all", () => {
		const panes = initialPanes(["a", "b", "c"]);
		const rest = removeChats(panes, new Set(["a", "c"]));
		expect(rest).toEqual([{ chatId: "b", size: 100, synced: true }]);
		expect(removeChats(panes, new Set(["a", "b", "c"]))).toEqual([]);
		expect(removeChats(panes, new Set(["x"]))).toEqual(panes);
	});

	it("hides panes, widens the rest, and puts the hidden ones back in place on save", () => {
		const saved = [
			{ chatId: "a", size: 20, synced: true },
			{ chatId: "hidden", size: 50, synced: false },
			{ chatId: "b", size: 30, synced: true },
		];
		const { shown, hidden } = splitHiddenPanes(
			saved,
			(pane) => pane.chatId !== "hidden",
		);
		expect(shown).toEqual([
			{ chatId: "a", size: 40, synced: true },
			{ chatId: "b", size: 60, synced: true },
		]);
		expect(hidden).toEqual([{ pane: saved[1], index: 1 }]);
		expect(withHiddenPanes(shown, hidden)).toEqual(saved);

		// After the viewer moves and adds panes, the hidden pane keeps its place and width.
		const next = addPane(movePane(shown, "b", -1), "c", hidden.length);
		const merged = withHiddenPanes(next, hidden);
		expect(ids(merged)).toEqual(["b", "hidden", "a", "c"]);
		expect(merged[1]?.size).toBe(50);
		expect(total(merged)).toBe(100);
	});

	it("leaves a list with nothing hidden as it is", () => {
		const panes = initialPanes(["a", "b"]);
		expect(splitHiddenPanes(panes, () => true)).toEqual({
			shown: panes,
			hidden: [],
		});
		expect(withHiddenPanes(panes, [])).toEqual(panes);
	});
});
