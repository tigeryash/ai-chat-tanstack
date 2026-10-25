# CLAUDE.md

AI chat app being rebuilt into a Vercel-AI-Playground-style app: several chat panes side by side, users bring
their own keys or local models, chats stored on their device first. Agents write most of the code, so the rules
and checks below are how mistakes get caught.

**Start here:** [docs/ROADMAP.md](docs/ROADMAP.md) is the plan. Work one slice at a time, meet its "Done when"
line, then tick the box and add a short *Status* note. Also read [docs/security.md](docs/security.md) before
touching keys, rendering, tools, local endpoints, or Convex writes, and keep
[docs/data-inventory.md](docs/data-inventory.md) current whenever a change adds, moves, or stores data.

## Commands

| Command | What it does |
|---|---|
| `bun install` | Install deps (also installs the pre-commit hook). CI uses `bun install --frozen-lockfile`. |
| `bun run dev` | Vite dev server on :3000. Needs `.env.local` (Convex URLs). |
| `bunx convex dev` | Push Convex functions and schema to the dev deployment and watch. Separate from `bun run dev`. |
| `bun run build` | Production build (Nitro, Vercel preset) into `.vercel/output`. |
| `sh scripts/vercel-build.sh` | Vercel's build command. `VERCEL_ENV=production` runs `convex deploy` (needs `CONVEX_DEPLOY_KEY`, Vercel Production scope only) around the Vite build; preview and local builds only run Vite. `--dry-run` prints the command. |
| `bun run serve` | Preview the production build (`vite preview`). |
| `bun run typecheck` | `tsc --noEmit` for the app, then for `convex/` with its own tsconfig (the check `convex deploy` runs). |
| `bun run check` / `bun run fix` | Biome lint + format check / apply safe fixes. |
| `bun run test` | Vitest unit tests (`src/**/*.test.ts(x)`, `convex/**/*.test.ts`, `scripts/**/*.test.ts`). |
| `bun run verify` | typecheck + Biome + Vitest. Run before every commit you hand over. |
| `bun run test:e2e` | Playwright against a production build (macOS screenshot baselines when run on a Mac). |
| `bun run test:e2e:linux` | Playwright inside CI's Linux image via Docker. Add `--update-snapshots` to refresh Linux baselines. |

The **pre-commit hook** (`.husky/pre-commit`) runs Biome on staged files and the type check. Don't bypass it with
`--no-verify`; fix the error instead. **CI** (`.github/workflows/ci.yml`) runs `verify` and Playwright on every PR.

`.claude/launch.json` has `dev` (:3000) and `serve` (:4173) for the preview browser. Signed out, only `/login` and
the `/e2e/*` test pages render (see Testing).

## Architecture

- **TanStack Start 1.169** (React 19, Vite 8 with Rolldown, Nitro). File routes live in `src/routes/`;
  `src/routeTree.gen.ts` is generated, so never edit it. `src/routes/__root.tsx` fetches the auth token during SSR
  (`beforeLoad`) and wraps the app in `ConvexBetterAuthProvider`. `(dashboard)` routes require a session today;
  `(auth)` holds login/signup. Server routes sit in `src/routes/api/` (`/api/auth/$` proxies to Convex,
  `/api/chat` streams a reply).
- **Convex** (`convex/`) is the backend: `schema.ts` (message `parts` mirror AI SDK `UIMessage` parts),
  access checks in `authHelpers.ts`, `_generated/` is generated. Query keys go through `@convex-dev/react-query`.
- **Better Auth 1.6.x** via `@convex-dev/better-auth` (server config `convex/auth.ts`, client
  `src/lib/auth-client.ts`, SSR helpers `src/lib/auth-server.ts`). Email/password plus Google, GitHub, Discord.
- **AI SDK 7.** Today `/api/chat` calls LM Studio from the server with the `<think>` middleware
  (`src/lib/reasoning-middleware.ts`), and `src/utilities/streamAssistantTurn.ts` writes the stream to Convex.
  Phase 1 replaces both with `useChat` and a browser-side transport (roadmap decision 7). Don't extend the old path.
- **UI**: Tailwind 4, shadcn components (Radix today, Base UI after roadmap 0.7), vendored ai-elements in
  `src/components/ai-elements/`, Motion for the composer, GSAP and React Three Fiber on the auth pages. The React
  Compiler runs through `@rolldown/plugin-babel`, so don't add `useMemo`/`useCallback` just for performance.
- **Env**: client vars are validated in `src/env.ts` (`VITE_` prefix). The server reads `VITE_CONVEX_URL` and
  `VITE_CONVEX_SITE_URL` from `process.env`. Convex's own secrets live in the Convex dashboard, not `.env.local`.

## Hard rules

1. **Keys never leave the browser except to their own provider** (decision 2). Never send a user's API key to our
   server, Convex, logs, analytics, error reports, URLs, exports, or sync payloads. Only the chat transport builds
   provider headers. The single exception is the opt-in durable agent run (decision 25,
   [security.md](docs/security.md)).
2. **Stay on Better Auth 1.6.x** (decision 5). `@convex-dev/better-auth` 0.12 requires `better-auth <1.7.0`.
   Don't bump `better-auth` until the adapter supports 1.7.
3. **Respect reduced motion** (decision 22). Every animation must honor `prefers-reduced-motion`: Motion through
   `<MotionConfig reducedMotion="user">`, GSAP through `gsap.matchMedia()`, and WebGL renders a single still frame.
   New animations ship with their reduced-motion behavior. The root `MotionConfig` makes Motion's position, size
   and layout animations instant (fades still play); anything outside Motion, like a CSS loop or the marquee, needs
   its own check. Use `FULL_MOTION` and `usePrefersReducedMotion()` from `src/lib/reduced-motion.ts`, and cover it
   in `e2e/reduced-motion.spec.ts`.
4. **Analytics never capture content** (decision 23). No prompts, replies, file contents, or keys in analytics,
   logs, or error reports. All events go through the one `track()` module and its allowlist (roadmap 1.8).
5. **Treat model output as untrusted.** Never render it as raw HTML; see [security.md](docs/security.md).
6. **Tests never call a real model.** Chat tests use the AI SDK mock model (`MockLanguageModelV4` and
   `simulateReadableStream` from `ai/test`). The e2e fixture fails any request that leaves the machine.
7. **Don't hand-edit `node_modules`.** Patches there vanish on reinstall and have broken dev before. If something
   upstream is broken, work around it in our code or config and leave a comment saying why.

## Conventions

- Biome formats and lints (tabs, double quotes; scope is set in `biome.json`). Run `bun run fix` for formatting.
- TypeScript strict, no `any` unless a comment says why. Import app code through `@/` (maps to `src/`).
- Small focused files. Match the surrounding code's naming and comment density.
- Unit tests sit next to the code as `*.test.ts`. Vitest runs in Node; a test that needs the DOM adds
  `// @vitest-environment jsdom` at the top.
- Commit messages: `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci). Commit on a branch
  per slice. Ask Yash before pushing or opening a PR.
- Don't change the composer's animations or behavior (`src/components/chat/input*`) unless the slice is about it.

## Testing

- **Vitest** config is `vitest.config.ts`, deliberately separate from `vite.config.ts` (the app's plugins crash
  Vitest and keep it from exiting).
- **Playwright** (`e2e/`, config `playwright.config.ts`) builds the app with `VITE_E2E=true` and runs it on :4174
  against `e2e/support/convex-stub.ts`, a local stand-in for Convex and Better Auth where everyone is signed out.
  No secrets or network needed.
- **Test pages** under `src/routes/e2e/` render components without a session (`/e2e/composer`). They exist in
  `bun run dev` and in `VITE_E2E` builds, and 404 in normal production builds. Add a page there when a test or a
  preview needs a component that normally sits behind sign-in.
- Import `test` and `expect` from `e2e/support/fixtures.ts`, not `@playwright/test`. Its automatic guards fail a
  test on any request that leaves the machine or any uncaught page error.
- **Screenshots**: baselines are per platform (`*-chromium-darwin.png` for local Macs, `*-chromium-linux.png` for
  CI). After an intentional visual change, refresh both: `bun run test:e2e --update-snapshots` and
  `bun run test:e2e:linux --update-snapshots`, then look at the new images before committing them.

## Gotchas (learned in Phase 0)

- **Keep `convex` at 1.46 or newer.** `CONVEX_DEPLOY_KEY` can deploy but not read data. Older CLIs read table sizes
  when a push drops an index, so production builds failed with "You do not have permission to perform this operation
  (deployment:data:view)". Upgrade the CLI rather than giving the key data access.
- **Vite 8 uses Node-style CJS interop** (the package is `"type": "module"`): a default import of a CommonJS
  module is `module.exports`, even with `__esModule`. "Element type is invalid … got: object" usually means a
  `.default` unwrap is needed (see `src/components/ui/shadcn-io/marquee/index.tsx`).
- **`vite.config.ts` filters out one devtools sub-plugin** (`@tanstack/devtools:event-client-setup`). In
  `@tanstack/devtools-vite` 0.8.1–0.8.5 it runs `bun outdated` on every `package.json` change, which itself
  touches `package.json`, so dev reloads every tab about 10 times a second. Keep the filter until upstream fixes it.
- **`ssr.noExternal` includes `/^@lobehub\//`** because their ESM builds use directory imports Node can't load.
  `@lobehub/icons` is pinned to 2.48.0 (5.x needs `@lobehub/ui@5` and `antd@6`).
- **If dev SSR fails strangely** ("The specifiers must be a non-empty string", reload loops), check
  `node_modules/@lobehub/ui/es/index.js` for stray exports, then `bun install --force` and delete
  `node_modules/.vite`.
- `src/routes/__root.tsx` has a `@ts-expect-error` for an upstream `@convex-dev/better-auth` `AuthClient` type bug.
  tsc flags it as unused once upstream fixes it; then delete it.
- `ai` 7 no longer re-exports `LanguageModelV*` types, so `reasoning-middleware.ts` derives its model type from
  `wrapLanguageModel`.
