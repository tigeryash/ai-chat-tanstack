// Tells the rest of the app that the saved keys changed (roadmap 2.2b), so the picker and the chat
// re-check which providers are connected. The message is only "changed": never a key, a provider
// or anything else about it. Other tabs hear it through a BroadcastChannel (remembered keys are
// shared by every tab of this origin; session keys stay in their own tab).

const CHANNEL = "highelo-keys";

const listeners = new Set<() => void>();
let channel: BroadcastChannel | null | undefined;

function openChannel(): BroadcastChannel | null {
	if (channel !== undefined) return channel;
	channel =
		typeof BroadcastChannel === "undefined"
			? null
			: new BroadcastChannel(CHANNEL);
	channel?.addEventListener("message", () => {
		for (const listener of listeners) listener();
	});
	return channel;
}

/** Call after a key is saved or deleted in this tab. */
export function notifyKeysChanged(): void {
	for (const listener of listeners) listener();
	openChannel()?.postMessage("changed");
}

/** Runs `listener` whenever keys change in this tab or another. Returns the unsubscribe. */
export function onKeysChanged(listener: () => void): () => void {
	openChannel();
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
