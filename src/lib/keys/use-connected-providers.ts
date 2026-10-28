import { useSyncExternalStore } from "react";
import { logError } from "@/lib/log";
import { onKeysChanged } from "./key-events";
import type { ProviderId } from "./providers";
import { listProviderKeys } from "./vault";

// Which providers have a key in this browser, shared by every component that asks. Loaded once, then
// reloaded whenever a key is saved or deleted (here or in another tab) and when the tab comes back
// into view, so a choice made while keys were loading, or before one was added, gets re-checked.

type Connected = ReadonlySet<ProviderId> | null;

let current: Connected = null;
let loading: Promise<void> | undefined;
let reloadAgain = false;
const listeners = new Set<() => void>();

function sameSet(a: Connected, b: Connected): boolean {
	if (a === null || b === null) return a === b;
	return a.size === b.size && [...a].every((id) => b.has(id));
}

function set(next: Connected) {
	if (sameSet(current, next)) return;
	current = next;
	for (const listener of listeners) listener();
}

/** Reads the key summaries (never a key). Overlapping calls coalesce into one more read. */
export function reloadConnectedProviders(): Promise<void> {
	if (loading) {
		reloadAgain = true;
		return loading;
	}
	loading = listProviderKeys()
		.then((keys) => set(new Set(keys.map((key) => key.providerId))))
		.catch((error) => {
			logError("Couldn't read saved API keys:", error);
			set(current ?? new Set());
		})
		.finally(() => {
			loading = undefined;
			if (reloadAgain) {
				reloadAgain = false;
				void reloadConnectedProviders();
			}
		});
	return loading;
}

const onVisible = () => {
	if (document.visibilityState === "visible") void reloadConnectedProviders();
};

let stopKeyEvents: (() => void) | undefined;

function subscribe(listener: () => void) {
	if (listeners.size === 0) {
		document.addEventListener("visibilitychange", onVisible);
		stopKeyEvents = onKeysChanged(() => void reloadConnectedProviders());
	}
	listeners.add(listener);
	if (current === null) void reloadConnectedProviders();
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			document.removeEventListener("visibilitychange", onVisible);
			stopKeyEvents?.();
		}
	};
}

/** Providers with a key in this browser, or null while the first read is in flight. */
export function useConnectedProviders(): Connected {
	return useSyncExternalStore(
		subscribe,
		() => current,
		() => null,
	);
}

/** For tests: forget what was loaded. */
export function resetConnectedProviders(): void {
	current = null;
}
