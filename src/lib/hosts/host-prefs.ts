import { AUTO_SORTS, type AutoSort } from "@/lib/chat/model-selection";
import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";

// The "Run with" switches that hold for every chat in this browser (roadmap 2.2b). The Auto switch
// itself is per chat (`ModelChoice.autoHost`).

export const HOST_PREFS_KEY = "highelo-host-prefs";

const hostPrefsSchema = z.object({
	/** Hide hosts with no key and hosts that are down. */
	hideUnavailable: z.boolean(),
	/** Only hosts that don't train on prompts. */
	noTrainingOnly: z.boolean(),
	/** What Auto optimizes for. */
	autoSort: z.enum(AUTO_SORTS),
});
export type HostPrefs = z.infer<typeof hostPrefsSchema>;

/** Reliable by default: the router's own load balancing already prefers hosts that are up. */
export const DEFAULT_HOST_PREFS: HostPrefs = {
	hideUnavailable: false,
	noTrainingOnly: false,
	autoSort: "reliable",
};

const prefs = createLocalStore<HostPrefs>(
	HOST_PREFS_KEY,
	hostPrefsSchema,
	DEFAULT_HOST_PREFS,
);

export function readHostPrefs(): HostPrefs {
	return prefs.read();
}

export function updateHostPrefs(change: Partial<HostPrefs>): void {
	prefs.write({ ...prefs.read(), ...change });
}

export function useHostPrefs() {
	return [prefs.use(), updateHostPrefs] as const;
}

export type { AutoSort };
