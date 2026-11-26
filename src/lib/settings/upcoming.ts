import type { SettingsSectionId } from "./sections";

// What lands in each Settings section in later slices, for the empty state of a section with no rows
// yet (a section with rows never shows it, so finished ones have none). Apart from `sections.ts` so every page's first load doesn't carry it (bundle budget).

export const SECTION_UPCOMING: Partial<Record<SettingsSectionId, string>> = {
	general: "How many panes a new chat starts with.",
	appearance: "A colored top border per model, to tell panes apart.",
	chat: "Reply stats, reasoning open or closed, and scroll sync defaults.",
	keyboard: "Changing a shortcut's keys.",
	notifications: "Notifications for agent runs.",
	models: "Per-model defaults and context-length warnings.",
	connections: "More connections, like a search tool key.",
	prompts: "A default system prompt for every chat.",
	privacy: "Your share links.",
	account: "Sync and sharing.",
};
