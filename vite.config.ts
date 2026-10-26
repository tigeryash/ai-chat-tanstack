import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import glslify from 'vite-plugin-glslify'


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
    nitro({
      preset: "vercel"
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
