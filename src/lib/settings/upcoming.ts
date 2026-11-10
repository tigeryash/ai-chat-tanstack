import type { SettingsSectionId } from "./sections";

// What lands in each Settings section in later slices, for the empty state of a section with no rows
// yet. Apart from `sections.ts` so every page's first load doesn't carry it (bundle budget).

export const SECTION_UPCOMING: Record<SettingsSectionId, string> = {
	general: "A default model for new chats and a model that names your chats.",
	appearance: "Theme presets.",
	chat: "Reply stats, reasoning open or closed, and scroll sync defaults.",
	keyboard: "A list of keyboard shortcuts.",
	notifications: "Notifications for agent runs.",
	models:
		"Host preferences: hosts to skip, a price cap for Auto, and per-model defaults.",
	connections: "More connections, like a search tool key.",
	prompts: "A default system prompt for every chat.",
	data: "Storage used on this device, and deleting every chat here.",
	privacy: "Your share links.",
	account: "Your profile, sign-in methods and signing out.",
};
