import type { SettingsSectionId } from "./sections";

// What lands in each Settings section in later slices, for the empty state of a section with no rows
// yet. Apart from `sections.ts` so every page's first load doesn't carry it (bundle budget).

export const SECTION_UPCOMING: Record<SettingsSectionId, string> = {
	general: "How many panes a new chat starts with.",
	appearance: "Theme presets.",
	chat: "Voice: dictation and a voice mode.",
	keyboard: "Changing a shortcut's keys.",
	notifications: "Notifications for agent runs.",
	models: "Per-model defaults and context-length warnings.",
	connections: "More connections, like a search tool key.",
	prompts: "A default system prompt for every chat.",
	data: "Storage used on this device, and deleting every chat here.",
	privacy: "Your share links.",
	account: "Your profile, sign-in methods and signing out.",
};
