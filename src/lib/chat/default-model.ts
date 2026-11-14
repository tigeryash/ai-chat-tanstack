import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";
import {
	type ModelChoice,
	modelChoiceSchema,
	readModelChoice,
	useModelChoice,
} from "./model-selection";

// Settings → General, "Default model for new chats" (roadmap R2 S2). New chats and new panes without
// a model of their own start on the last model picked in this browser (the default, as before), or
// on one fixed model. Kept in this browser's localStorage; it holds no key and no chat content.

export const DEFAULT_MODEL_STORAGE_KEY = "highelo-default-model";

export const DEFAULT_MODEL_MODES = ["last", "fixed"] as const;
export type DefaultModelMode = (typeof DEFAULT_MODEL_MODES)[number];

const defaultModelSettingSchema = z.object({
	mode: z.enum(DEFAULT_MODEL_MODES),
	/** The fixed model. Kept when switching back to "last", so switching again restores it. */
	choice: modelChoiceSchema.optional(),
});
export type DefaultModelSetting = z.infer<typeof defaultModelSettingSchema>;

export const LAST_USED_DEFAULT: DefaultModelSetting = { mode: "last" };

const setting = createLocalStore<DefaultModelSetting>(
	DEFAULT_MODEL_STORAGE_KEY,
	defaultModelSettingSchema,
	LAST_USED_DEFAULT,
);

/** The model a new chat starts on: the fixed one when set, else the last pick (null for none yet). */
export function resolveDefaultModel(
	current: DefaultModelSetting,
	lastPick: ModelChoice | null,
): ModelChoice | null {
	if (current.mode === "fixed" && current.choice?.model) return current.choice;
	return lastPick;
}

export function readDefaultModelChoice(): ModelChoice | null {
	return resolveDefaultModel(setting.read(), readModelChoice());
}

export function useDefaultModelSetting() {
	return [setting.use(), setting.write] as const;
}

/**
 * The model new chats start on, kept current for every component that reads it. Reads the stores
 * through `use…` hooks: the React Compiler would cache a bare `setting.use()` call as a plain value.
 */
export function useDefaultModelChoice(): ModelChoice | null {
	const [current] = useDefaultModelSetting();
	const [lastPick] = useModelChoice();
	return resolveDefaultModel(current, lastPick);
}
