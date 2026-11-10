// The Settings dialog's sections (roadmap R2 S1, docs/settings-research.md section 2). This module is
// tiny on purpose: the root route parses `?settings=<section>` with it on every page, so it must not
// import the controls. The rows live in `registry.ts`, and each section's "coming here" note in
// `upcoming.ts`, which only the dialog loads.

export const SETTINGS_SECTION_IDS = [
	"general",
	"appearance",
	"chat",
	"keyboard",
	"notifications",
	"models",
	"connections",
	"prompts",
	"data",
	"privacy",
	"account",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

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

/** Where Settings opens when no section, or an unknown one, is asked for. */
export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = "general";

const SECTION_BY_ID = new Map(SETTINGS_SECTIONS.map((s) => [s.id, s]));

export function settingsSection(id: SettingsSectionId): SettingsSection {
	const section = SECTION_BY_ID.get(id);
	if (!section) throw new Error(`Unknown settings section: ${id}`);
	return section;
}

function isSectionId(value: string): value is SettingsSectionId {
	return SECTION_BY_ID.has(value as SettingsSectionId);
}

/**
 * The section `?settings=` asks for. Absent means Settings is closed (`undefined`); any other value
 * opens it, and one that isn't a section (a typo, an old link) opens the default section.
 */
export function parseSettingsSection(
	value: unknown,
): SettingsSectionId | undefined {
	if (value === undefined || value === null) return undefined;
	const text = String(value).trim().toLowerCase();
	return isSectionId(text) ? text : DEFAULT_SETTINGS_SECTION;
}

export interface SettingsSearch {
	settings?: SettingsSectionId;
}

/** The root route's `validateSearch`: every page accepts `?settings=<section>`. */
export function validateSettingsSearch(
	search: Record<string, unknown>,
): SettingsSearch {
	const settings = parseSettingsSection(search.settings);
	return settings ? { settings } : {};
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
