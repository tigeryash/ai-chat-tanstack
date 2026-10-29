import { useSyncExternalStore } from "react";
import { authClient } from "@/lib/auth-client";
import type { Viewer } from "@/lib/storage/ownership";

// Who is using the app, from Better Auth's session (roadmap 1.9): their user ID, or null when signed
// out. Stored chats are shown by this (src/lib/storage/ownership.ts). Better Auth keeps the session in
// one store and refetches it after sign-in and sign-out, and whenever the tab comes back into view.

type SessionState = ReturnType<typeof authClient.useSession>;

interface SessionStore {
	subscribe(listener: (state: SessionState) => void): () => void;
}

// Better Auth's session store isn't typed on `$store`; it's the store `useSession` reads.
const sessionStore = () => authClient.$store.atoms.session as SessionStore;

/** Settled means Better Auth isn't fetching the session, so the answer is current. */
function settledViewer(state: SessionState): Viewer | undefined {
	if (state.isPending || state.isRefetching) return undefined;
	// A failed session check (offline, say) reads as signed out, which shows fewer chats, not more.
	return state.data?.user.id ?? null;
}

// The last settled viewer. Kept through refetches: signed out, every refetch on focus marks the
// session pending again, and the app shouldn't blank its chats each time.
let lastViewer: Viewer | undefined;
const listeners = new Set<() => void>();
let stopWatching: (() => void) | undefined;

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	stopWatching ??= sessionStore().subscribe((state) => {
		const viewer = settledViewer(state);
		if (viewer === undefined || viewer === lastViewer) return;
		lastViewer = viewer;
		for (const notify of listeners) notify();
	});
	return () => {
		listeners.delete(listener);
		if (listeners.size > 0) return;
		stopWatching?.();
		stopWatching = undefined;
	};
}

/** The viewer, or undefined until Better Auth has first checked the session. */
export function useViewer(): Viewer | undefined {
	return useSyncExternalStore(
		subscribe,
		() => lastViewer,
		() => undefined,
	);
}

/**
 * The viewer, once Better Auth has checked the session and finished any refetch (after a sign-out,
 * say). For code outside React, like route loaders.
 */
export function currentViewer(): Promise<Viewer> {
	return new Promise((resolve) => {
		let settled = false;
		const stop = sessionStore().subscribe((state) => {
			const viewer = settledViewer(state);
			if (settled || viewer === undefined) return;
			settled = true;
			resolve(viewer);
			// The store calls this right away on subscribe, before `stop` exists.
			queueMicrotask(() => stop());
		});
	});
}
