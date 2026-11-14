import { LOCAL_PROVIDER, providerName } from "@/lib/chat/model-selection";
import {
	AUTO_HOST,
	choiceWithHost,
	connectedHosts,
	currentHost,
} from "@/lib/hosts/host-choice";
import { logWarn } from "@/lib/log";
import { routesFor } from "@/lib/models/runnability";
import type { Prompt } from "@/lib/prompts/prompt";
import {
	addPaneToFocused,
	focusedPane,
	focusedPaneState,
	type PaneControls,
	removeFocusedPane,
	stopAllPanes,
} from "@/lib/workspaces/focused-pane";
import type { Command, CommandContext } from "./command";
import { shortcutOf } from "./keymap";
import { PANE_COMMAND_IDS } from "./pane-command-ids";

// Pane actions (roadmap R2 S7, docs/settings-research.md section 3 "v2"): commands on the focused pane
// (`lib/workspaces/focused-pane.ts`). Each is listed only when its `when` finds the focused pane can do
// it, and each runs the pane's own control, read when it runs, so a keyboard shortcut (S6) can run the
// same command. Rows made from your data (prompts) and from the catalog (models, hosts) set a `kind`,
// so neither their names nor their ids reach analytics or the recent list. Copying a reply copies text
// only, and nothing about it is tracked (hard rule 4).

/** One local server and the model ids it reported. */
export interface LocalModelList {
	endpointId: string;
	endpointName: string;
	models: readonly string[];
}

export interface PaneCommandData {
	/** The focused pane; undefined with no chat on screen. */
	pane: PaneControls | undefined;
	/** Every pane on screen, for Stop all and the synced panes. */
	panes: readonly PaneControls[];
	/** The viewer's saved prompts (through `usePrompts`, so only theirs). */
	prompts: readonly Prompt[];
	/** What saved local servers report; asked only while the model page shows. */
	localModels: readonly LocalModelList[];
}

const CURRENT = "Current";

function syncedPanes(panes: readonly PaneControls[]): PaneControls[] {
	return panes.filter((pane) => pane.synced === true);
}

function copyLastReply(): void {
	const text = focusedPane()?.lastReplyText?.();
	if (text === undefined) return;
	navigator.clipboard
		.writeText(text)
		.catch((error) => logWarn("Couldn't copy the reply:", error));
}

/** The model page: models from saved local servers, then catalog models a connected key runs. */
export function modelCommands(data: PaneCommandData): Command[] {
	const pane = data.pane;
	if (!pane) return [];
	const { choice, catalog, connected } = pane.model;
	const local = data.localModels.flatMap(
		({ endpointId, endpointName, models }) =>
			models.map((model): Command => {
				const current =
					choice?.provider === LOCAL_PROVIDER &&
					choice.model === model &&
					choice.endpoint === endpointId;
				return {
					id: `model:local:${endpointId}:${model}`,
					kind: "pane.model",
					title: model,
					detail: current ? `${endpointName} · ${CURRENT}` : endpointName,
					keywords: ["local", endpointName],
					group: "actions",
					run: () =>
						focusedPane()?.model.pick({
							provider: LOCAL_PROVIDER,
							model,
							endpoint: endpointId,
						}),
				};
			}),
	);
	const runnable = connected
		? catalog.filter((model) => routesFor(model, connected).length > 0)
		: [];
	const ordered = [
		...runnable.filter((model) => model.highElo),
		...runnable.filter((model) => !model.highElo),
	];
	const hosted = ordered.map((model): Command => {
		const current = choice?.gatewayId === model.gatewayId;
		const detail = model.highElo ? "High Elo" : undefined;
		return {
			id: `model:${model.gatewayId}`,
			kind: "pane.model",
			title: model.name,
			detail: current ? [detail, CURRENT].filter(Boolean).join(" · ") : detail,
			keywords: [model.gatewayId, model.developer],
			group: "actions",
			run: () => focusedPane()?.model.pickCatalogModel(model),
		};
	});
	return [...local, ...hosted];
}

/** The host page: Auto, then each connected host serving the model (excluded ones left out). */
export function hostCommands(pane: PaneControls | undefined): Command[] {
	const choice = pane?.model.choice;
	if (!pane || !choice) return [];
	const current = currentHost(choice);
	const hosts = connectedHosts(pane.model.hosts).filter(
		(option) => option.excluded === undefined,
	);
	const options = [
		{ value: AUTO_HOST, title: "Auto (best connected host)" },
		...hosts.map((option) => ({
			value: option.provider as string,
			title: providerName(option.provider),
		})),
	];
	return options.map(
		({ value, title }): Command => ({
			id: `host:${value}`,
			kind: "pane.host",
			title,
			detail: value === current ? CURRENT : undefined,
			keywords: ["host", "provider"],
			group: "actions",
			run: () => {
				const target = focusedPane();
				const from = target?.model.choice;
				if (!target || !from) return;
				const next = choiceWithHost(from, target.model.hosts, value);
				if (next) target.model.setChoice(next);
			},
		}),
	);
}

/** The prompt pages: each saved prompt, applied to the focused pane or to every synced pane. */
export function promptCommands(
	prompts: readonly Prompt[],
	to: "pane" | "synced",
): Command[] {
	return prompts.map(
		(prompt): Command => ({
			id: `prompt:${prompt.id}`,
			kind: to === "pane" ? "prompt.apply" : "prompt.apply-synced",
			title: prompt.name,
			keywords: prompt.tags,
			group: "actions",
			run: () => {
				const pane = focusedPane();
				if (!pane) return;
				// Read when it runs, like the pane: the synced set may have changed.
				const panes =
					to === "pane" ? [pane] : syncedPanes(focusedPaneState().panes);
				for (const target of panes) target.applyPrompt(prompt);
			},
		}),
	);
}

/** Every pane action, listed only when the focused pane can do it. */
export function paneCommands(data: PaneCommandData): Command[] {
	const synced = syncedPanes(data.panes);
	const has =
		(test: (pane: PaneControls) => boolean) => (context: CommandContext) =>
			context.pane !== undefined && test(context.pane);
	return [
		{
			id: PANE_COMMAND_IDS.add,
			title: "Add pane",
			keywords: ["split", "compare", "new pane", "workspace"],
			group: "actions",
			shortcut: shortcutOf(PANE_COMMAND_IDS.add),
			when: has((pane) => pane.addPane !== undefined),
			run: () => {
				addPaneToFocused();
			},
		},
		{
			id: PANE_COMMAND_IDS.remove,
			title: "Remove pane",
			detail: data.pane?.label,
			keywords: ["close pane", "delete pane"],
			group: "actions",
			shortcut: shortcutOf(PANE_COMMAND_IDS.remove),
			when: has((pane) => pane.removePane !== undefined),
			run: () => {
				removeFocusedPane();
			},
		},
		{
			id: PANE_COMMAND_IDS.sync,
			title: "Sync pane",
			detail: data.pane?.label,
			keywords: ["synced", "send to all", "together"],
			group: "actions",
			checked: data.pane?.synced === true,
			when: has((pane) => pane.setSynced !== undefined),
			run: () => {
				const pane = focusedPane();
				pane?.setSynced?.(!pane.synced);
			},
		},
		{
			id: PANE_COMMAND_IDS.switchModel,
			title: "Switch model…",
			detail: data.pane?.label,
			keywords: ["model", "change model", "pick model", "llm"],
			group: "actions",
			shortcut: shortcutOf(PANE_COMMAND_IDS.switchModel),
			when: has(() => true),
			opens: {
				title: "Switch model",
				placeholder: "Search models…",
				empty:
					"No models to switch to. Add a key or a local server in Settings.",
				commands: () => modelCommands(data),
			},
			run: () => {},
		},
		{
			id: PANE_COMMAND_IDS.switchHost,
			title: "Switch host…",
			detail: data.pane?.label,
			keywords: ["host", "provider", "route", "via"],
			group: "actions",
			when: has(
				(pane) =>
					pane.model.choice !== null &&
					connectedHosts(pane.model.hosts).length >= 2,
			),
			opens: {
				title: "Switch host",
				placeholder: "Search hosts…",
				empty: "No other host serves this model.",
				commands: () => hostCommands(data.pane),
			},
			run: () => {},
		},
		{
			id: PANE_COMMAND_IDS.applyPrompt,
			title: "Apply saved prompt…",
			detail: data.pane?.label,
			keywords: ["system prompt", "prompt library", "instructions"],
			group: "actions",
			when: has(() => true),
			opens: {
				title: "Apply prompt",
				placeholder: "Search saved prompts…",
				empty: "No saved prompts yet. Make one on the Prompts page.",
				commands: () => promptCommands(data.prompts, "pane"),
			},
			run: () => {},
		},
		{
			id: PANE_COMMAND_IDS.applyPromptSynced,
			title: "Apply saved prompt to synced panes…",
			detail: `${synced.length} panes`,
			keywords: ["system prompt", "prompt library", "all panes"],
			group: "actions",
			when: has((pane) => pane.synced === true && synced.length > 1),
			opens: {
				title: "Apply prompt to synced panes",
				placeholder: "Search saved prompts…",
				empty: "No saved prompts yet. Make one on the Prompts page.",
				commands: () => promptCommands(data.prompts, "synced"),
			},
			run: () => {},
		},
		{
			id: PANE_COMMAND_IDS.modelSettings,
			title: "Open model settings",
			detail: data.pane?.label,
			keywords: ["temperature", "parameters", "system prompt", "params"],
			group: "actions",
			when: has((pane) => pane.openModelSettings !== undefined),
			run: () => focusedPane()?.openModelSettings?.(),
		},
		{
			id: PANE_COMMAND_IDS.copyReply,
			title: "Copy last reply",
			detail: data.pane?.label,
			keywords: ["clipboard", "copy answer", "response"],
			group: "actions",
			when: has((pane) => pane.lastReplyText !== undefined),
			run: copyLastReply,
		},
		{
			id: PANE_COMMAND_IDS.regenerate,
			title: "Regenerate last reply",
			detail: data.pane?.label,
			keywords: ["retry", "reroll", "again"],
			group: "actions",
			when: has((pane) => pane.regenerate !== undefined),
			run: () => focusedPane()?.regenerate?.(),
		},
		{
			id: PANE_COMMAND_IDS.stopAll,
			title: "Stop all replies",
			keywords: ["stop", "cancel", "abort"],
			group: "actions",
			when: has(() => data.panes.some((pane) => pane.busy)),
			run: stopAllPanes,
		},
	];
}
