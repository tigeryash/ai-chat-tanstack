import { readFileSync } from "node:fs";
import path from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";
import glslify from "vite-plugin-glslify";
import { CSP_REPORT_PATH } from "./src/lib/security/csp";
import { SECURITY_HEADERS } from "./src/lib/security/headers";

// Nitro's dev server (nitro/dist/_build/vite.dev.mjs) treats any request whose `Sec-Fetch-Dest` isn't
// document/iframe/frame/empty as a static asset and hands it to Vite, which 404s. Browsers send CSP
// reports with `Sec-Fetch-Dest: report`, so in dev they never reached /api/csp-report. Relabel them
// before Nitro looks. Dev only; production builds route by path.
function cspReportsInDev(): Plugin {
	return {
		name: "csp-reports-in-dev",
		apply: "serve",
		configureServer(server) {
			server.middlewares.use((req, _res, next) => {
				if (
					req.url?.startsWith(CSP_REPORT_PATH) &&
					req.headers["sec-fetch-dest"] === "report"
				) {
					req.headers["sec-fetch-dest"] = "empty";
				}
				next();
			});
		},
	};
}

// `ai` ships as one module, so every chat page would preload streamText and the gateway SDK alongside
// `useChat`'s `Chat`. Only src/lib/chat/ai-engine.ts imports the request side, and only modules that load
// on the first send import it, so in the client build its "ai" becomes a second copy of the module
// (a second id next to the real file): the page keeps the `Chat` half and the first send loads the rest. Their shared
// dependencies (@ai-sdk/provider, provider-utils, zod) stay single. AI SDK errors are checked with
// `isInstance` (a global symbol), so they work across the copies. Dev and SSR use plain "ai".
// Keep every lazy chat module's "ai" import going through ai-engine.ts: a lazy chunk that also imports
// the page's copy changes how Rolldown merges shared chunks, and the root preloads grew 2 KB.
const AI_ENGINE = path.resolve("src/lib/chat/ai-engine.ts");
const AI_ENGINE_SUFFIX = ".ai-engine.js";
function aiEngineCopy(): Plugin {
	return {
		name: "ai-engine-copy",
		apply: "build",
		enforce: "pre",
		async resolveId(source, importer, options) {
			if (source !== "ai" || importer !== AI_ENGINE) return null;
			if (this.environment.name !== "client") return null;
			const resolved = await this.resolve(source, importer, {
				...options,
				skipSelf: true,
			});
			// A path next to the real file, so its relative imports, its dependencies and the package's
			// `sideEffects: false` resolve as they do for the original.
			return resolved && { id: resolved.id.replace(/\.js$/, AI_ENGINE_SUFFIX) };
		},
		load(id) {
			if (!id.endsWith(AI_ENGINE_SUFFIX)) return null;
			return readFileSync(
				`${id.slice(0, -AI_ENGINE_SUFFIX.length)}.js`,
				"utf8",
			);
		},
	};
}

const config = defineConfig({
	// Vite 8 resolves the `@/` alias from tsconfig.json itself.
	resolve: { tsconfigPaths: true },
	ssr: {
		noExternal: ["@convex-dev/better-auth"],
	},
	plugins: [
		// devtools-vite (0.8.1–0.8.5) re-runs `bun outdated` on every package.json change, and `bun outdated`
		// itself fires a package.json change, so dev loops and nitro full-reloads every tab ~10x/s.
		// Drop only that sub-plugin (the devtools "outdated packages" panel); the rest stays.
		devtools().filter(
			(plugin) => plugin.name !== "@tanstack/devtools:event-client-setup",
		),
		// Before nitro(), so its middleware runs first.
		cspReportsInDev(),
		aiEngineCopy(),
		nitro({
			preset: "vercel",
			// Static files never reach our server middleware (src/start.ts), so the same security headers
			// go into Vercel's routing config (.vercel/output/config.json) for them. Not `routeRules`:
			// Nitro writes header rules without `continue: true`, and a catch-all route that stops matching
			// would keep requests from reaching the server function.
			vercel: {
				config: {
					version: 3,
					routes: [{ src: "/(.*)", headers: SECURITY_HEADERS, continue: true }],
				},
			},
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		// plugin-react v6 dropped its `babel` option; the compiler runs through rolldown's babel plugin.
		babel({ presets: [reactCompilerPreset()] }),
		glslify(),
		// glsl({
		//   include: [
		//     // Glob pattern, or array of glob patterns to import
		//     "**/*.glsl",
		//     "**/*.wgsl",
		//     "**/*.vert",
		//     "**/*.frag",
		//     "**/*.vs",
		//     "**/*.fs",
		//   ],
		//   exclude: undefined, // Glob pattern, or array of glob patterns to ignore
		//   warnDuplicatedImports: true, // Warn if the same chunk was imported multiple times
		//   defaultExtension: "glsl", // Shader suffix when no extension is specified
		//   watch: true, // Recompile shader on change
		//   root: "/", // Directory for root imports
		// }),
	],
});

export default config;
