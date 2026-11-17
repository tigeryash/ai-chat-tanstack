// The pane actions' command ids (roadmap R2 S7). Apart from `pane-commands.ts` so the keymap and the
// dashboard shell's key listener can name them without loading the commands (bundle budget).

/** Command ids S6's shortcuts bind to. */
export const PANE_COMMAND_IDS = {
	add: "pane.add",
	remove: "pane.remove",
	sync: "pane.sync",
	switchModel: "pane.switch-model",
	switchHost: "pane.switch-host",
	applyPrompt: "pane.apply-prompt",
	applyPromptSynced: "pane.apply-prompt-synced",
	modelSettings: "pane.model-settings",
	copyReply: "pane.copy-reply",
	regenerate: "pane.regenerate",
	stopAll: "pane.stop-all",
} as const;
