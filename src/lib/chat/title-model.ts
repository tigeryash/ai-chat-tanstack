import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";
import { type ModelChoice, modelChoiceSchema } from "./model-selection";

// Settings → General, "Title model" (roadmap R2 S2). Off by default: a chat is named after the first
// line of its first message. On: that message goes, once, to the chosen model, in this browser with
// the user's own key (resolved like any chat request, `resolveAppModel`), to write a short title.
// The writer is `chat-title-writer.ts`; this module holds only the setting, so Settings can import it
// without the AI SDK.

export const TITLE_MODEL_STORAGE_KEY = "highelo-title-model";

const titleModelSettingSchema = z.object({
	enabled: z.boolean(),
	/** Kept when switched off, so switching on again restores it. */
	choice: modelChoiceSchema.optional(),
});
export type TitleModelSetting = z.infer<typeof titleModelSettingSchema>;

export const TITLE_MODEL_OFF: TitleModelSetting = { enabled: false };

const setting = createLocalStore<TitleModelSetting>(
	TITLE_MODEL_STORAGE_KEY,
	titleModelSettingSchema,
	TITLE_MODEL_OFF,
);

export function useTitleModelSetting() {
	return [setting.use(), setting.write] as const;
}

/** The model that writes titles, or null while the setting is off or has no model. */
export function titleModelChoice(
	current: TitleModelSetting = setting.read(),
): ModelChoice | null {
	return current.enabled && current.choice?.model ? current.choice : null;
}
