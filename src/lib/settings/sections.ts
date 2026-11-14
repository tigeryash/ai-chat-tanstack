// The Settings dialog's sections (roadmap R2 S1, docs/settings-research.md section 2): labels, groups and
// the nav order. Every page parses `?settings=<section>` with `section-ids.ts` instead, which has no
// text, so none of this is in the first load. The rows live in `registry.ts`, and each section's
// "coming here" note in `upcoming.ts`.

import type { SettingsSectionId } from "./section-ids";

export {
	DEFAULT_SETTINGS_SECTION,
	parseSettingsSection,
	type SettingsSectionId,
	validateSettingsSearch,
} from "./section-ids";

export type SettingsGroupId = "app" | "models" | "you";

export interface SettingsSection {
	id: SettingsSectionId;
	label: string;
	group: SettingsGroupId;
}

export const SETTINGS_GROUPS: readonly {
	id: SettingsGroupId;
	label: string;
}[] = [
	{ id: "app", label: "App" },
	{ id: "models", label: "Models" },
	{ id: "you", label: "You" },
];

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
	{
		id: "general",
		label: "General",
		group: "app",
	},
	{
		id: "appearance",
		label: "Appearance",
		group: "app",
	},
	{
		id: "chat",
		label: "Chat",
		group: "app",
	},
	{
		id: "keyboard",
		label: "Keyboard",
		group: "app",
	},
	{
		id: "notifications",
		label: "Notifications",
		group: "app",
	},
	{
		id: "models",
		label: "Models & hosts",
		group: "models",
	},
	{
		id: "connections",
		label: "Connections",
		group: "models",
	},
	{
		id: "prompts",
		label: "Prompts",
		group: "models",
	},
	{
		id: "data",
		label: "Your data",
		group: "you",
	},
	{
		id: "privacy",
		label: "Privacy",
		group: "you",
	},
	{
		id: "account",
		label: "Account",
		group: "you",
	},
];

const SECTION_BY_ID = new Map(SETTINGS_SECTIONS.map((s) => [s.id, s]));

export function settingsSection(id: SettingsSectionId): SettingsSection {
	const section = SECTION_BY_ID.get(id);
	if (!section) throw new Error(`Unknown settings section: ${id}`);
	return section;
}

// Anchors the old Settings page had (`/settings#provider-keys`), mapped to their section.
const LEGACY_ANCHORS: Record<string, SettingsSectionId> = {
	keys: "connections",
	"provider-keys": "connections",
	"connect-openrouter": "connections",
	"local-endpoints": "connections",
	"background-status": "notifications",
	appearance: "appearance",
	"your-data": "data",
	analytics: "privacy",
};

/** The section an old `/settings` link lands on: its anchor's section, else Connections (the old page led with API keys). */
export function sectionForLegacySettingsLink(hash: string): SettingsSectionId {
	return LEGACY_ANCHORS[hash.replace(/^#/, "")] ?? "connections";
}
