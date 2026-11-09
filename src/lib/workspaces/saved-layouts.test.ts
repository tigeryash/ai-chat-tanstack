// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
	deleteLayout,
	type LayoutPane,
	MAX_SAVED_LAYOUTS,
	readSavedLayouts,
	SAVED_LAYOUTS_KEY,
	saveLayout,
	suggestLayoutName,
} from "./saved-layouts";

// Saved layouts (roadmap 3.5): pane models, widths and Synced switches, never chat content.

const opus = {
	provider: "openrouter",
	model: "anthropic/claude-opus-5.5",
	gatewayId: "anthropic/claude-opus-5.5",
	autoHost: true,
} as const;
const panes: LayoutPane[] = [
	{ model: opus, size: 60, synced: true },
	{ model: null, size: 40, synced: false },
];

describe("saved layouts", () => {
	beforeEach(() => {
		for (const layout of readSavedLayouts()) deleteLayout(layout.id);
	});

	it("saves, reads back after a reload, and deletes", () => {
		const layout = saveLayout("  Opus vs default ", panes, 1000);
		expect(layout).toMatchObject({
			name: "Opus vs default",
			panes,
			savedAt: 1000,
		});
		const stored = JSON.parse(localStorage.getItem(SAVED_LAYOUTS_KEY) ?? "[]");
		expect(stored).toEqual([layout]);
		expect(JSON.stringify(stored)).not.toMatch(/chatId|messages/);
		expect(readSavedLayouts()).toEqual([layout]);
		deleteLayout(layout.id);
		expect(readSavedLayouts()).toEqual([]);
	});

	it("names a layout from its models when the name is blank", () => {
		expect(suggestLayoutName(panes)).toBe(
			"anthropic/claude-opus-5.5 vs Default model",
		);
		expect(saveLayout("   ", panes).name).toBe(suggestLayoutName(panes));
	});

	it("keeps only the newest layouts", () => {
		for (let n = 0; n < MAX_SAVED_LAYOUTS + 2; n++) saveLayout(`L${n}`, panes);
		const names = readSavedLayouts().map((layout) => layout.name);
		expect(names).toHaveLength(MAX_SAVED_LAYOUTS);
		expect(names[0]).toBe("L2");
	});

	it("refuses a layout with no panes", () => {
		expect(() => saveLayout("empty", [])).toThrow();
		expect(readSavedLayouts()).toEqual([]);
	});
});
