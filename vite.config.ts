import { defineConfig, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import glslify from 'vite-plugin-glslify'
import { CSP_REPORT_PATH } from './src/lib/security/csp'
import { SECURITY_HEADERS } from './src/lib/security/headers'


// Nitro's dev server (nitro/dist/_build/vite.dev.mjs) treats any request whose `Sec-Fetch-Dest` isn't
// document/iframe/frame/empty as a static asset and hands it to Vite, which 404s. Browsers send CSP
// reports with `Sec-Fetch-Dest: report`, so in dev they never reached /api/csp-report. Relabel them
// before Nitro looks. Dev only; production builds route by path.
function cspReportsInDev(): Plugin {
  return {
    name: 'csp-reports-in-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith(CSP_REPORT_PATH) && req.headers['sec-fetch-dest'] === 'report') {
          req.headers['sec-fetch-dest'] = 'empty'
        }
        next()
      })
    },
  }
}

const config = defineConfig({
   // Vite 8 resolves the `@/` alias from tsconfig.json itself.
   resolve: { tsconfigPaths: true },
   ssr: {
    noExternal: ['@convex-dev/better-auth'],
  },
  plugins: [
    // devtools-vite (0.8.1–0.8.5) re-runs `bun outdated` on every package.json change, and `bun outdated`
    // itself fires a package.json change, so dev loops and nitro full-reloads every tab ~10x/s.
    // Drop only that sub-plugin (the devtools "outdated packages" panel); the rest stays.
    devtools().filter((plugin) => plugin.name !== '@tanstack/devtools:event-client-setup'),
    // Before nitro(), so its middleware runs first.
    cspReportsInDev(),
    nitro({
      preset: "vercel",
      // Static files never reach our server middleware (src/start.ts), so the same security headers
      // go into Vercel's routing config (.vercel/output/config.json) for them. Not `routeRules`:
      // Nitro writes header rules without `continue: true`, and a catch-all route that stops matching
      // would keep requests from reaching the server function.
      vercel: {
        config: {
          version: 3,
          routes: [{ src: '/(.*)', headers: SECURITY_HEADERS, continue: true }],
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
})

export default config
