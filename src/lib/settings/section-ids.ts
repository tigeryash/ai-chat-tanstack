// The Settings sections' ids and the `?settings=<section>` parser (roadmap R2 S1). The root route runs
// this on every page, so it holds no labels or other text (bundle budget); those are in `sections.ts`.

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

/** Where Settings opens when no section, or an unknown one, is asked for. */
export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = "general";

function isSectionId(value: string): value is SettingsSectionId {
	return (SETTINGS_SECTION_IDS as readonly string[]).includes(value);
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
