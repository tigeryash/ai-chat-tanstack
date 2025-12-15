import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import glsl from 'vite-plugin-glsl'
import glslify from 'vite-plugin-glslify'


const config = defineConfig({
  plugins: [
    devtools(),
    nitro({
      vercel: {
        functions: {
          runtime: "bun1.3.3",
        },
      },
    }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
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
