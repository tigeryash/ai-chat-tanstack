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

/** The saved-key list for settings, plus the actions that change it. Never holds a full key. */
export function useProviderKeys() {
	const [loaded, setLoaded] = useState<LoadedKeys | null>(null);

	useEffect(() => {
		loadKeys().then(setLoaded);
	}, []);

	const save = async (
		providerId: ProviderId,
		key: string,
		mode: KeyMode,
		source: KeySource = "manual",
	) => {
		await saveProviderKey(providerId, key, mode, source);
		setLoaded(await loadKeys());
	};

	const remove = async (providerId: ProviderId) => {
		await deleteProviderKey(providerId);
		setLoaded(await loadKeys());
	};

	return {
		keys: loaded?.keys ?? null,
		loadError: loaded?.error ?? null,
		save,
		remove,
	};
}
