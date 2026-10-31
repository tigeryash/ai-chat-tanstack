import { useSyncExternalStore } from "react";
import { logWarn } from "@/lib/log";
import type { z } from "@/lib/zod";

// A small value kept in this browser's localStorage, validated on read and shared by every component
// that reads it (also across tabs, through the `storage` event). Bad, old or blocked storage reads as
// `fallback`. Never put keys or chat content in one.

export interface LocalStore<T> {
	read(): T;
	write(value: T): void;
	use(): T;
	/** Calls `listener` after every write, here or in another tab. Returns the unsubscribe. */
	subscribe(listener: () => void): () => void;
}

export function createLocalStore<T>(
	key: string,
	schema: z.ZodType<T>,
	fallback: T,
): LocalStore<T> {
	const listeners = new Set<() => void>();
	let loaded = false;
	let current = fallback;

	const load = (): T => {
		try {
			const raw = localStorage.getItem(key);
			if (!raw) return fallback;
			const parsed = schema.safeParse(JSON.parse(raw));
			return parsed.success ? parsed.data : fallback;
		} catch {
			return fallback;
		}
	};
	const notify = () => {
		for (const listener of listeners) listener();
	};
	const read = (): T => {
		if (!loaded) {
			current = load();
			loaded = true;
		}
		return current;
	};
	const write = (value: T) => {
		current = schema.parse(value);
		loaded = true;
		try {
			localStorage.setItem(key, JSON.stringify(current));
		} catch (error) {
			// Private windows can refuse storage; the value still holds for this page.
			logWarn(`Couldn't save ${key}:`, error);
		}
		notify();
	};
	const subscribe = (listener: () => void) => {
		listeners.add(listener);
		const onStorage = (event: StorageEvent) => {
			if (event.key !== key) return;
			current = load();
			notify();
		};
		window.addEventListener("storage", onStorage);
		return () => {
			listeners.delete(listener);
			window.removeEventListener("storage", onStorage);
		};
	};
	return {
		read,
		write,
		subscribe,
		use: () => useSyncExternalStore(subscribe, read, () => fallback),
	};
}
