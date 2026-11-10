import { useEffect, useState } from "react";
import {
	deleteProviderKey,
	type KeyMode,
	type KeySummary,
	listProviderKeys,
	saveProviderKey,
} from "@/lib/keys";
import type { KeySource } from "@/lib/keys/key-store";
import type { ProviderId } from "@/lib/keys/providers";
import { logError } from "@/lib/log";

interface LoadedKeys {
	keys: KeySummary[];
	error: string | null;
}

async function loadKeys(): Promise<LoadedKeys> {
	try {
		return { keys: await listProviderKeys(), error: null };
	} catch (error) {
		logError("Couldn't read saved API keys:", error);
		return {
			keys: [],
			error:
				"Couldn't read the keys saved in this browser. Private windows and some privacy settings block storage.",
		};
	}
}

// Every mounted list re-reads after a change, so the Connect OpenRouter row and the key list (separate
// rows in Settings) agree on what's saved.
const reloaders = new Set<() => void>();

function reloadAll() {
	for (const reload of reloaders) reload();
}

/** The saved-key list for settings, plus the actions that change it. Never holds a full key. */
export function useProviderKeys() {
	const [loaded, setLoaded] = useState<LoadedKeys | null>(null);

	useEffect(() => {
		let live = true;
		const reload = () => {
			loadKeys().then((next) => {
				if (live) setLoaded(next);
			});
		};
		reload();
		reloaders.add(reload);
		return () => {
			live = false;
			reloaders.delete(reload);
		};
	}, []);

	const save = async (
		providerId: ProviderId,
		key: string,
		mode: KeyMode,
		source: KeySource = "manual",
	) => {
		await saveProviderKey(providerId, key, mode, source);
		reloadAll();
	};

	const remove = async (providerId: ProviderId) => {
		await deleteProviderKey(providerId);
		reloadAll();
	};

	return {
		keys: loaded?.keys ?? null,
		loadError: loaded?.error ?? null,
		save,
		remove,
	};
}
