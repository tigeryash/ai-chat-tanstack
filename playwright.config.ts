import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const APP_PORT = 4174;
const CONVEX_STUB_PORT = 4175;
const convexStubUrl = `http://127.0.0.1:${CONVEX_STUB_PORT}`;

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 1 : 0,
	// Playwright's default is half the CPUs, which leaves two of the CI runner's four idle.
	workers: isCI ? 4 : undefined,
	reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
	use: {
		baseURL: `http://localhost:${APP_PORT}`,
		trace: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1280, height: 720 },
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
				// Nothing in e2e may reach a real model, including an LM Studio running on this machine: the
				// chat's "Local" provider points at a dead port.
				VITE_LMSTUDIO_BASE_URL: "http://127.0.0.1:9/v1",
			},
			timeout: 180_000,
			reuseExistingServer: !isCI,
		},
	],
});
