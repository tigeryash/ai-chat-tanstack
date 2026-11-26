// The theme presets' ids (roadmap R2 S9, docs/settings-research.md section 4), apart from their data
// (presets.ts) so the settings schema, which every page's appearance sync loads, stays small.

export const PRESET_IDS = [
	"default",
	"high-contrast",
	"brand",
	"paper",
	"nord",
	"dracula",
] as const;
export type PresetId = (typeof PRESET_IDS)[number];
