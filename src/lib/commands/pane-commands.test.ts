import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogModel } from "@/lib/models/catalog";
import type { Prompt } from "@/lib/prompts/prompt";
import {
	focusedPaneState,
	type PaneControls,
	registerPane,
	unregisterPane,
} from "@/lib/workspaces/focused-pane";
import { analyticsIdOf, type Command, isRememberable } from "./command";
import {
	modelCommands,
	PANE_COMMAND_IDS,
	type PaneCommandData,
	paneCommands,
	promptCommands,
} from "./pane-commands";

function pane(extra: Partial<PaneControls> = {}): PaneControls {
	return {
		chatId: "chat-1",
		index: 0,
		label: "Pane 1",
		busy: false,
		stop: vi.fn(),
		applyPrompt: vi.fn(),
		model: {
			choice: { provider: "local", model: "alpha", endpoint: "stub" },
			wanted: null,
			catalog: [],
			connected: new Set(),
			hosts: [],
			pick: vi.fn(),
			pickCatalogModel: vi.fn(),
			setChoice: vi.fn(),
		},
		...extra,
	};
}

const data = (extra: Partial<PaneCommandData> = {}): PaneCommandData => ({
	pane: undefined,
	panes: [],
	prompts: [],
	localModels: [],
	...extra,
});

const listed = (commands: Command[], focused: PaneControls | undefined) =>
	commands
		.filter(
			(command) => command.when?.({ pathname: "/w/x", pane: focused }) ?? true,
		)
		.map((command) => command.id);

afterEach(() => {
	for (const entry of focusedPaneState().panes) unregisterPane(entry.chatId);
});

describe("paneCommands", () => {
	it("lists nothing without a focused pane", () => {
		expect(listed(paneCommands(data()), undefined)).toEqual([]);
	});

	it("lists only what the focused pane can do", () => {
		const single = pane();
		expect(
			listed(paneCommands(data({ pane: single, panes: [single] })), single),
		).toEqual([PANE_COMMAND_IDS.switchModel, PANE_COMMAND_IDS.applyPrompt]);
		const full = pane({
			busy: true,
			synced: true,
			setSynced: vi.fn(),
			addPane: vi.fn(),
			removePane: vi.fn(),
			openModelSettings: vi.fn(),
			lastReplyText: () => "reply",
			regenerate: vi.fn(),
		});
		const other = pane({ chatId: "chat-2", index: 1, synced: true });
		expect(
			listed(paneCommands(data({ pane: full, panes: [full, other] })), full),
		).toEqual(
			expect.arrayContaining([
				PANE_COMMAND_IDS.add,
				PANE_COMMAND_IDS.remove,
				PANE_COMMAND_IDS.sync,
				PANE_COMMAND_IDS.applyPromptSynced,
				PANE_COMMAND_IDS.modelSettings,
				PANE_COMMAND_IDS.copyReply,
				PANE_COMMAND_IDS.regenerate,
				PANE_COMMAND_IDS.stopAll,
			]),
		);
	});

	it("runs on the pane focused when it runs", () => {
		const focused = pane({ removePane: vi.fn() });
		registerPane(focused);
		const remove = paneCommands(data()).find(
			(command) => command.id === PANE_COMMAND_IDS.remove,
		);
		void remove?.run({} as never);
		expect(focused.removePane).toHaveBeenCalledOnce();
	});
});

describe("nested pages", () => {
	it("model rows send only their kind to analytics and aren't remembered", () => {
		const model = {
			gatewayId: "dev/model",
			name: "Model",
			developer: "dev",
			highElo: true,
			openRouterId: "dev/model",
			nativeIds: [],
		} as unknown as CatalogModel; // only the fields the page reads
		const focused = pane({
			model: {
				...pane().model,
				catalog: [model],
				connected: new Set(["openrouter"]),
			},
		});
		registerPane(focused);
		const rows = modelCommands(
			data({
				pane: focused,
				localModels: [
					{
						endpointId: "stub",
						endpointName: "Stub",
						models: ["alpha", "beta"],
					},
				],
			}),
		);
		expect(rows.map((row) => row.title)).toEqual(["alpha", "beta", "Model"]);
		expect(rows[0]?.detail).toBe("Stub · Current");
		for (const row of rows) {
			expect(analyticsIdOf(row)).toBe("pane.model");
			expect(isRememberable(row)).toBe(false);
		}
		void rows[1]?.run({} as never);
		expect(focused.model.pick).toHaveBeenCalledWith({
			provider: "local",
			model: "beta",
			endpoint: "stub",
		});
		void rows[2]?.run({} as never);
		expect(focused.model.pickCatalogModel).toHaveBeenCalledWith(model);
	});

	it("applies a prompt to the focused pane, or to every synced pane", () => {
		const prompt = {
			id: "p1",
			name: "Secret name",
			tags: [],
		} as unknown as Prompt;
		const one = pane({ synced: true });
		const two = pane({ chatId: "chat-2", index: 1, synced: true });
		const three = pane({ chatId: "chat-3", index: 2, synced: false });
		for (const entry of [one, two, three]) registerPane(entry);

		const [toPane] = promptCommands([prompt], "pane");
		expect(analyticsIdOf(toPane as Command)).toBe("prompt.apply");
		void toPane?.run({} as never);
		expect(one.applyPrompt).toHaveBeenCalledWith(prompt);
		expect(two.applyPrompt).not.toHaveBeenCalled();

		const [toSynced] = promptCommands([prompt], "synced");
		void toSynced?.run({} as never);
		expect(two.applyPrompt).toHaveBeenCalledWith(prompt);
		expect(three.applyPrompt).not.toHaveBeenCalled();
	});
});
