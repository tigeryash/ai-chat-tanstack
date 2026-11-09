import {
	type ModelChoice,
	modelChoiceSchema,
} from "@/lib/chat/model-selection";
import { createLocalStore } from "@/lib/local-store";
import { MAX_PANES } from "@/lib/storage/workspace";
import { z } from "@/lib/zod";

// Saved layouts (roadmap 3.5): a workspace's pane models, widths and Synced switches under a name, to
// open again as a new workspace with fresh chats. Kept in this browser's localStorage, like each chat's
// model choice: no messages, titles, chat ids or keys, so a layout says nothing about any chat.

export const SAVED_LAYOUTS_KEY = "highelo-saved-layouts";
/** Oldest layouts go first once there are more. */
export const MAX_SAVED_LAYOUTS = 20;
export const LAYOUT_NAME_MAX = 60;

const layoutPaneSchema = z.object({
	/** Null: the pane follows the default for new chats. */
	model: modelChoiceSchema.nullable(),
	size: z.number().min(0).max(100),
	synced: z.boolean(),
});
export type LayoutPane = z.infer<typeof layoutPaneSchema>;

const savedLayoutSchema = z.object({
	id: z.string().min(1).max(64),
	name: z.string().trim().min(1).max(LAYOUT_NAME_MAX),
	panes: z.array(layoutPaneSchema).min(1).max(MAX_PANES),
	savedAt: z.number().int().nonnegative(),
});
export type SavedLayout = z.infer<typeof savedLayoutSchema>;

const layouts = createLocalStore<SavedLayout[]>(
	SAVED_LAYOUTS_KEY,
	z.array(savedLayoutSchema).max(MAX_SAVED_LAYOUTS),
	[],
);

/** Every saved layout, newest last, shared by every component that reads them. */
export function useSavedLayouts(): SavedLayout[] {
	return layouts.use();
}

export function readSavedLayouts(): SavedLayout[] {
	return layouts.read();
}

/** A layout name from its panes' models, for the name field's default. */
export function suggestLayoutName(panes: readonly LayoutPane[]): string {
	const names = panes.map((pane) => modelLabel(pane.model));
	return names.join(" vs ").slice(0, LAYOUT_NAME_MAX);
}

/** What a pane's model reads as in a list: the catalog id, else the provider's id, else "Default". */
export function modelLabel(model: ModelChoice | null): string {
	return model?.gatewayId || model?.model || "Default model";
}

/** Saves a layout under `name` (a blank name gets the suggested one). Returns it. */
export function saveLayout(
	name: string,
	panes: readonly LayoutPane[],
	now = Date.now(),
): SavedLayout {
	const layout = savedLayoutSchema.parse({
		id: crypto.randomUUID(),
		name: name.trim().slice(0, LAYOUT_NAME_MAX) || suggestLayoutName(panes),
		panes: panes.slice(0, MAX_PANES),
		savedAt: now,
	});
	layouts.write([...layouts.read(), layout].slice(-MAX_SAVED_LAYOUTS));
	return layout;
}

export function deleteLayout(id: string): void {
	layouts.write(layouts.read().filter((layout) => layout.id !== id));
}
