import { createEnv } from "@t3-oss/env-core";
import { z } from "@/lib/zod";

// Client variables, validated when this module loads. Vite inlines `import.meta.env.VITE_*` at build
// time, so the server bundle sees the same values. Server-only code that needs them at runtime (the
// Better Auth proxy in `auth-server.ts`) reads `process.env` instead.
export const env = createEnv({
	clientPrefix: "VITE_",

	client: {
		VITE_CONVEX_URL: z.url(),
		VITE_CONVEX_SITE_URL: z.url(),
		// Build-time switch for the /e2e test pages (on in dev regardless). Set only by playwright.config.ts.
		VITE_E2E: z.enum(["true", "false"]).optional(),
	},

	runtimeEnv: import.meta.env,

	// Treat `VAR=` in a .env file as unset rather than as an empty string.
	emptyStringAsUndefined: true,
});
