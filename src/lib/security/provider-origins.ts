// Relative, not `@/`: vite.config.ts imports this file (through csp.ts), and Vite's config loader
// doesn't know the alias.
import {
	PROVIDER_IDS,
	PROVIDER_REGISTRY,
} from "../../models/provider-registry";

// API origins the browser may call directly (roadmap decision 3: model calls go browser → provider).
// This list is the CSP `connect-src` allowlist, so a provider origin added to the registry becomes
// reachable from the page, and one missing there is blocked once the CSP is enforced. It's built from
// each registry entry's reviewed `apiOrigins`: CORS for each was checked on 2026-10-20; check it again
// before adding one. provider-origins.test.ts pins the list, so any change shows up in review.
export const PROVIDER_API_ORIGINS: readonly string[] = [
	...new Set(PROVIDER_IDS.flatMap((id) => PROVIDER_REGISTRY[id].apiOrigins)),
];

// Local model servers (LM Studio, Ollama) on any port. Chrome's Local Network Access prompt still
// asks the user first (docs/security.md, "Local model servers").
export const LOCAL_MODEL_ORIGINS = [
	"http://localhost:*",
	"http://127.0.0.1:*",
] as const;
