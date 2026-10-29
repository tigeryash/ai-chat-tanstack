import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";

// Chrome's Local Network Access (Chrome 142+): before a public site's first request to localhost,
// Chrome asks the user, and a "Block" sticks (Chrome won't ask again). So we explain the prompt first,
// send that first request only from a click, and after a failure ask the Permissions API whether the
// permission was denied, to show how to re-allow it. Other browsers don't have the prompt.

export type NetworkAccessState = "granted" | "denied" | "prompt" | "unknown";

/**
 * Chrome 142 named the permission "local-network-access"; later versions split it into
 * "loopback-network" (localhost, which is what we call) and "local-network". The first name the
 * browser knows wins.
 */
const PERMISSION_NAMES = [
	"loopback-network",
	"local-network-access",
	"local-network",
] as const;

export async function localNetworkAccess(
	permissions: Pick<Permissions, "query"> | undefined = globalThis.navigator
		?.permissions,
): Promise<NetworkAccessState> {
	if (!permissions) return "unknown";
	for (const name of PERMISSION_NAMES) {
		try {
			// Not in TypeScript's PermissionName list yet.
			const status = await permissions.query({
				name: name as PermissionName,
			});
			return status.state;
		} catch {
			// This browser doesn't know the name; try the next one.
		}
	}
	return "unknown";
}

const explained = createLocalStore<boolean>(
	"highelo-local-network-explained",
	z.boolean(),
	false,
);

/** Whether the user has read our explainer and clicked through it once in this browser. */
export function useNetworkAccessExplained(): boolean {
	return explained.use();
}

export function markNetworkAccessExplained(): void {
	explained.write(true);
}
