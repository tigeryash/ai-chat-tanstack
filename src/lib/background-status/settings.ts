import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";

// Background status settings (roadmap 3.10), kept in this browser. `askedPermission` records that we
// already offered notifications once, so the offer never comes back on its own.

export const BACKGROUND_STATUS_KEY = "highelo-background-status";

const schema = z.object({
	tabStatus: z.boolean(),
	notifyFinished: z.boolean(),
	notifyFailed: z.boolean(),
	askedPermission: z.boolean(),
});

export type BackgroundStatusSettings = z.infer<typeof schema>;

export const DEFAULT_BACKGROUND_STATUS: BackgroundStatusSettings = {
	tabStatus: true,
	notifyFinished: true,
	notifyFailed: true,
	askedPermission: false,
};

export const backgroundStatusSettings = createLocalStore(
	BACKGROUND_STATUS_KEY,
	schema,
	DEFAULT_BACKGROUND_STATUS,
);

export function updateBackgroundStatusSettings(
	change: Partial<BackgroundStatusSettings>,
): void {
	backgroundStatusSettings.write({
		...backgroundStatusSettings.read(),
		...change,
	});
}

/** Wrapped in a `use…` function so React (and its compiler) treat the read as a hook. */
export function useBackgroundStatusSettings(): BackgroundStatusSettings {
	return backgroundStatusSettings.use();
}
