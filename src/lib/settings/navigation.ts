import { useNavigate, useRouter } from "@tanstack/react-router";
import type { SettingId } from "./registry";
import { DEFAULT_SETTINGS_SECTION, type SettingsSectionId } from "./sections";

// Settings is a dialog driven by `?settings=<section>` (docs/settings-research.md, "Container"). Opening
// it pushes one history entry and switching sections replaces it, so Back closes the dialog instead of
// stepping through sections. Closing it from inside (Esc, the close button) goes back when this tab
// pushed that entry, and otherwise (a deep link, a reload) drops the parameter in place.
// Every one of these navigations passes `resetScroll: false`: the router's scroll restoration would
// otherwise reset or restore scroll positions on the page behind (a chat) and inside the dialog.

let openedByPush = false;
// A row to focus and highlight when the dialog next opens (the command palette's settings search).
let pendingHighlight: SettingId | null = null;

/** Call when an opening navigation pushes the entry (a `SettingsLink` click does). */
export function markSettingsPushed() {
	openedByPush = true;
}

/** Call when the dialog closes by any route (Back included), so the next close doesn't go back twice. */
export function forgetSettingsPush() {
	openedByPush = false;
	pendingHighlight = null;
}

/** The row the dialog should focus and highlight as it opens, if one was asked for. */
export function settingToHighlight(): SettingId | null {
	return pendingHighlight;
}

export function withSettings<T extends object>(
	search: T,
	section: SettingsSectionId,
): T & { settings: SettingsSectionId } {
	return { ...search, settings: section };
}

export function withoutSettings<T extends { settings?: unknown }>(
	search: T,
): Omit<T, "settings"> {
	const { settings: _closed, ...rest } = search;
	return rest;
}

export function useSettingsNavigation() {
	const navigate = useNavigate();
	const router = useRouter();

	return {
		/** With `setting`, the dialog opens with that row focused and highlighted. */
		open(
			section: SettingsSectionId = DEFAULT_SETTINGS_SECTION,
			setting?: SettingId,
		) {
			markSettingsPushed();
			pendingHighlight = setting ?? null;
			void navigate({
				to: ".",
				search: (prev) => withSettings(prev, section),
				resetScroll: false,
			});
		},
		select(section: SettingsSectionId) {
			void navigate({
				to: ".",
				search: (prev) => withSettings(prev, section),
				replace: true,
				resetScroll: false,
			});
		},
		close() {
			if (openedByPush) {
				forgetSettingsPush();
				router.history.back();
				return;
			}
			void navigate({
				to: ".",
				search: (prev) => withoutSettings(prev),
				replace: true,
				resetScroll: false,
			});
		},
	};
}
