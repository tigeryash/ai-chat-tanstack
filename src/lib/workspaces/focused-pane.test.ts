import { afterEach, describe, expect, it, vi } from "vitest";
import {
	focusedPane,
	focusedPaneState,
	focusPane,
	type PaneControls,
	registerPane,
	stopAllPanes,
	unregisterPane,
} from "./focused-pane";

function paneAt(index: number, busy = false): PaneControls {
	return {
		chatId: `chat-${index}`,
		index,
		label: `Pane ${index + 1}`,
		busy,
		stop: vi.fn(),
		applyPrompt: vi.fn(),
		model: {
			choice: null,
			wanted: null,
			catalog: [],
			connected: null,
			hosts: [],
			pick: vi.fn(),
			pickCatalogModel: vi.fn(),
			setChoice: vi.fn(),
		},
	};
}

afterEach(() => {
	for (const pane of focusedPaneState().panes) unregisterPane(pane.chatId);
});

describe("focused pane", () => {
	it("is pane 1 until another is focused, and pane 1 again when that one goes", () => {
		expect(focusedPane()).toBeUndefined();
		registerPane(paneAt(1));
		registerPane(paneAt(0));
		expect(focusedPane()?.chatId).toBe("chat-0");
		focusPane("chat-1");
		expect(focusedPane()?.chatId).toBe("chat-1");
		unregisterPane("chat-1");
		expect(focusedPane()?.chatId).toBe("chat-0");
	});

	it("lists panes in pane order and takes new controls for the same pane", () => {
		registerPane(paneAt(1));
		registerPane(paneAt(0));
		expect(focusedPaneState().panes.map((pane) => pane.index)).toEqual([0, 1]);
		const busy = paneAt(0, true);
		registerPane(busy);
		expect(focusedPaneState().panes[0]).toBe(busy);
	});

	it("stops only the panes that are replying", () => {
		const idle = paneAt(0);
		const replying = paneAt(1, true);
		registerPane(idle);
		registerPane(replying);
		stopAllPanes();
		expect(replying.stop).toHaveBeenCalledOnce();
		expect(idle.stop).not.toHaveBeenCalled();
	});
});
