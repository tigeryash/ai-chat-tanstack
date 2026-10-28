import { useEffect, useState } from "react";
import { logError } from "@/lib/log";
import type { ProviderId } from "./providers";
import { listProviderKeys } from "./vault";

/** Providers with a key in this browser, or null while loading. Reads summaries, never a key. */
export function useConnectedProviders(): ReadonlySet<ProviderId> | null {
	const [connected, setConnected] = useState<ReadonlySet<ProviderId> | null>(
		null,
	);
	useEffect(() => {
		listProviderKeys()
			.then((keys) => setConnected(new Set(keys.map((key) => key.providerId))))
			.catch((error) => {
				logError("Couldn't read saved API keys:", error);
				setConnected(new Set());
			});
	}, []);
	return connected;
}
