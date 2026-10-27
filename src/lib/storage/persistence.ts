import { logWarn } from "@/lib/log";

// Persistent storage (roadmap decision 9). Without it the browser may evict IndexedDB under storage
// pressure, and Safari can wipe it after 7 days of use without a visit. Request it at a meaningful
// moment, after the first chat is saved: Firefox shows a prompt, Chrome decides from engagement.
// Export/import (export.ts) and cloud sync remain the real backstops.

export type PersistenceState = "persisted" | "not-persisted" | "unsupported";

export interface StorageStatus {
	persistence: PersistenceState;
	/** From `navigator.storage.estimate()`; `null` when the browser doesn't say. */
	usageBytes: number | null;
	quotaBytes: number | null;
}

type StorageApi = Partial<
	Pick<StorageManager, "persist" | "persisted" | "estimate">
>;

function browserStorage(): StorageApi | undefined {
	return typeof navigator === "undefined" ? undefined : navigator.storage;
}

async function currentState(
	storage: StorageApi | undefined,
): Promise<PersistenceState> {
	if (!storage?.persisted) return "unsupported";
	return (await storage.persisted()) ? "persisted" : "not-persisted";
}

/** Asks once per call; returns without asking if storage is already persistent. Never throws. */
export async function requestPersistentStorage(
	storage: StorageApi | undefined = browserStorage(),
): Promise<PersistenceState> {
	try {
		const state = await currentState(storage);
		if (state !== "not-persisted" || !storage?.persist) return state;
		return (await storage.persist()) ? "persisted" : "not-persisted";
	} catch (error) {
		logWarn(
			"[storage] persistent storage request failed",
			(error as Error).name,
		);
		return "not-persisted";
	}
}

/** For settings: whether storage is persistent, and how much is used. Never throws. */
export async function getStorageStatus(
	storage: StorageApi | undefined = browserStorage(),
): Promise<StorageStatus> {
	let persistence: PersistenceState = "unsupported";
	let estimate: StorageEstimate = {};
	try {
		persistence = await currentState(storage);
		estimate = (await storage?.estimate?.()) ?? {};
	} catch (error) {
		logWarn("[storage] storage status unavailable", (error as Error).name);
	}
	return {
		persistence,
		usageBytes: estimate.usage ?? null,
		quotaBytes: estimate.quota ?? null,
	};
}
