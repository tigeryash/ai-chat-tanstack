import babel from "@rolldown/plugin-babel";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts on purpose: the app config loads nitro, TanStack Start, and the
// devtools plugins, which crash Vitest ("module is not defined") and keep it from exiting.
export default defineConfig({
	// The React Compiler, as in the app build, so render-count tests (chat-screen.test.tsx) measure
	// what ships.
	plugins: [babel({ presets: [reactCompilerPreset()] })],
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		include: [
			"src/**/*.test.{ts,tsx}",
			"convex/**/*.test.ts",
			"scripts/**/*.test.ts",
		],
		// Pure logic by default. A test that needs the DOM opts in with `// @vitest-environment jsdom`.
		environment: "node",
		// `src/env.ts` requires these. Placeholders: unit tests never reach Convex.
		env: {
			VITE_CONVEX_URL: "https://placeholder.convex.cloud",
			VITE_CONVEX_SITE_URL: "https://placeholder.convex.site",
		},
	},
});
