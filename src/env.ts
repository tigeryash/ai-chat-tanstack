import { createEnv } from "@t3-oss/env-core";
import { z } from "@/lib/zod";

export const env = createEnv({
	server: {
		SERVER_URL: z.string().url().optional(),
	},

	/**
	 * The prefix that client-side variables must have. This is enforced both at
	 * a type-level and at runtime.
	 */
	clientPrefix: "VITE_",

	client: {
		VITE_APP_TITLE: z.string().min(1).optional(),
		// The local model server the chat picker's "Local" option calls (roadmap 1.2). The CSP allows
		// localhost and 127.0.0.1 only.
		VITE_LMSTUDIO_BASE_URL: z.string().url().optional(),
		// Build-time switch for the /e2e test pages (on in dev regardless). Set only by playwright.config.ts.
		VITE_E2E: z.enum(["true", "false"]).optional(),
	},

	/**
	 * What object holds the environment variables at runtime. This is usually
	 * `process.env` or `import.meta.env`.
	 */
	runtimeEnv: import.meta.env,

	/**
	 * By default, this library will feed the environment variables directly to
	 * the Zod validator.
	 *
	 * This means that if you have an empty string for a value that is supposed
	 * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
	 * it as a type mismatch violation. Additionally, if you have an empty string
	 * for a value that is supposed to be a string with a default value (e.g.
	 * `DOMAIN=` in an ".env" file), the default value will never be applied.
	 *
	 * In order to solve these issues, we recommend that all new projects
	 * explicitly specify this option as true.
	 */
	emptyStringAsUndefined: true,
});

export const DEFAULT_LMSTUDIO_BASE_URL = "http://localhost:1234/v1";
