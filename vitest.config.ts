import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts on purpose: the app config loads nitro, TanStack Start, and the
// devtools plugins, which crash Vitest ("module is not defined") and keep it from exiting.
export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		include: ["src/**/*.test.{ts,tsx}", "convex/**/*.test.ts"],
		// Pure logic by default. A test that needs the DOM opts in with `// @vitest-environment jsdom`.
		environment: "node",
	},
});
