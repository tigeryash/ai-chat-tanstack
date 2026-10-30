import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const APP_PORT = 4174;
const CONVEX_STUB_PORT = 4175;
const convexStubUrl = `http://127.0.0.1:${CONVEX_STUB_PORT}`;

export default defineConfig<{ enforceStrictCsp: boolean }>({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 1 : 0,
	reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
	use: {
		baseURL: `http://localhost:${APP_PORT}`,
		trace: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			testIgnore: "csp-enforced.spec.ts",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1280, height: 720 },
			},
		},
		{
			// The specs that call providers, local servers and the chat runtime, with the strict CSP
			// enforced (src/lib/security/csp.ts, ENFORCE_STRICT_CSP): proof the switch can be flipped.
			name: "csp-enforced",
			testMatch: [
				"chat.spec.ts",
				"chat-keys.spec.ts",
				"keys.spec.ts",
				"local-models.spec.ts",
				"xss.spec.ts",
				"csp-enforced.spec.ts",
			],
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1280, height: 720 },
				enforceStrictCsp: true,
			},
		},
	],
	webServer: [
		{
			command: "bun e2e/support/convex-stub.ts",
			url: `${convexStubUrl}/api/auth/get-session`,
			env: { CONVEX_STUB_PORT: String(CONVEX_STUB_PORT) },
			reuseExistingServer: !isCI,
		},
		{
			// A production build with the /e2e harness pages switched on (VITE_E2E), served by `vite preview`.
			command: `bun run build && bun run serve --port ${APP_PORT} --strictPort`,
			url: `http://localhost:${APP_PORT}/login`,
			env: {
				VITE_E2E: "true",
				VITE_CONVEX_URL: convexStubUrl,
				VITE_CONVEX_SITE_URL: convexStubUrl,
			},
			timeout: 180_000,
			reuseExistingServer: !isCI,
		},
	],
});
