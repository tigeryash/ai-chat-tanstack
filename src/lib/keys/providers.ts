import {
	PROVIDER_IDS,
	PROVIDER_REGISTRY,
	type ProviderId,
} from "@/models/provider-registry";

// The providers a user can add a key for, from the provider registry (src/models/provider-registry.ts).
// Each one's API origin is in the CSP allowlist (src/lib/security/provider-origins.ts); a key is only
// ever sent to its own provider's origin.

export { PROVIDER_IDS, type ProviderId };

export interface ProviderInfo {
	name: string;
	/** Where the user creates a key. Opened in a new tab, never fetched. */
	keyPageUrl: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = PROVIDER_REGISTRY;

export function isProviderId(value: unknown): value is ProviderId {
	return (
		typeof value === "string" &&
		(PROVIDER_IDS as readonly string[]).includes(value)
	);
}
