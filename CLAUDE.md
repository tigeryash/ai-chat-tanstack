# CLAUDE.md

AI chat app being rebuilt into a Vercel-AI-Playground-style app: several chat panes side by side, users bring
their own keys or local models, chats stored on their device first. Agents write most of the code, so the rules
and checks below are how mistakes get caught.

**Start here:** [docs/ROADMAP.md](docs/ROADMAP.md) is the plan. Work one slice per session, meet its "Done when"
line, then tick the box and add one *Status* line with the PR link (details go in the PR description, not the
roadmap). Also read [docs/security.md](docs/security.md) before
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

`.claude/launch.json` has `dev` (:3000) and `serve` (:4173) for the preview browser. Everything renders signed out (no login wall).

## Architecture

- **TanStack Start 1.169** (React 19, Vite 8 with Rolldown, Nitro). File routes live in `src/routes/`;
  `src/routeTree.gen.ts` is generated, so never edit it. `src/routes/__root.tsx` fetches the auth token during SSR
  (`beforeLoad`) and wraps the app in `ConvexBetterAuthProvider`. `(dashboard)` (`ssr: false`) needs no session
  (decision 4: no login wall) and holds the sidebar (`src/components/sidebar/`, roadmap 1.4); `(auth)` holds login, sign-up, forgot and reset password (its layout sends signed-in visitors to `/new`; the forms
  share `src/components/auth/auth-form.tsx`). Server routes sit in `src/routes/api/` (`/api/auth/$` proxies to
  Convex, `/api/csp-report` logs CSP violations). There is no chat route on our server.
- **Security baseline** (roadmap 1.0, `src/lib/security/`): `getRouter` makes a CSP nonce per request, the root
  route's `headers` sends the policy (strict one report-only for now), and `src/start.ts` adds the security headers
  and Start's server-function CSRF check to every response. A new provider or third-party origin the browser
  calls must go in `provider-origins.ts` / `csp.ts`, or the CSP reports it.
- **Convex** (`convex/`) is the backend: `schema.ts` (message `parts` mirror AI SDK `UIMessage` parts),
  access checks in `authHelpers.ts`, `_generated/` is generated. Query keys go through `@convex-dev/react-query`.
- **Local chats** (roadmap 1.3, `src/lib/storage/`): a `ChatStore` interface over Dexie (IndexedDB database
  `highelo-chats`). Every stored chat has a `formatVersion`; `format.ts` lists the migrations and how to add one.
  Export/import are versioned JSON in `export.ts`.
- **Better Auth 1.6.x** via `@convex-dev/better-auth` (server config `convex/auth.ts`, client
  `src/lib/auth-client.ts`, SSR helpers `src/lib/auth-server.ts`). Email/password plus Google, GitHub, Discord.
- **AI SDK 7, chat in the browser** (roadmap 1.2, `src/lib/chat/`). Chat routes (`/new`, `/$chatId`, both
  `ssr: false`) run `useChat` on `Chat` objects from `chat-sessions.ts`, which outlive a route (so `/new` hands a
  streaming chat to `/$chatId`) and save to the ChatStore when a reply finishes. `BrowserChatTransport` runs
  `streamText` in the page against the provider in each request's `body` (`language-model.ts`; local models get
  the `<think>` middleware). Tests use `mockChatModel` (`src/lib/chat/mock-model.ts`) and the `/e2e/chat` pages; in `VITE_E2E`
  builds the local model `e2e-mock-model` is the mock too (`e2e-model.ts`), so Playwright can drive `/new`.
- **Models** (roadmap 2.1–2.2): Convex `models` table synced daily (`convex/modelCatalogSync.ts`, curation in
  `src/models/curation.ts`). The app reads `models.list` / `models.get` over HTTP (`src/lib/models/catalog.ts`), and
  the e2e Convex stub serves the seeded catalog in `src/lib/models/test-catalog.ts`. Runnability per user is
  `src/lib/models/runnability.ts`; the picker, model card and removed-model banner are in `src/components/models/`.
  Each chat's model choice is kept by `src/lib/chat/chat-model-choice.ts`.
- **UI**: Tailwind 4, shadcn components on Base UI (`base-vega` style; add more with `bunx shadcn add <name>`,
  then change their `cn` import from `"cn"` to `@/lib/utils`), no Radix. `src/components/ai-elements/` keeps the
  AI SDK Elements export names but is built on shadcn's AI Elements patterns (Message, Trace, Message Scroller).
  The shadcn variants and utilities (`data-open:`, `shimmer`, `scroll-fade-*`) come from the vendored
  `src/shadcn-tailwind.css`. Motion for the composer, GSAP and React Three Fiber on the auth pages. The React
  Compiler runs through `@rolldown/plugin-babel`, so don't add `useMemo`/`useCallback` just for performance.
- **Env**: client vars are validated in `src/env.ts` (`VITE_` prefix). The server reads `VITE_CONVEX_URL` and
  `VITE_CONVEX_SITE_URL` from `process.env`. Convex's own secrets live in the Convex dashboard, not `.env.local`.

## Hard rules

1. **Keys never leave the browser except to their own provider** (decision 2). Never send a user's API key to our
   server, Convex, logs, analytics, error reports, URLs, exports, or sync payloads. Only the chat transport builds
   provider headers (plus the settings key test in `src/lib/keys/test-key.ts`); read keys only through
   `getProviderKey` from `@/lib/keys`. The single exception is the opt-in durable agent run (decision 25,
   [security.md](docs/security.md)).
2. **Stay on Better Auth 1.6.x** (decision 5). `@convex-dev/better-auth` 0.12 requires `better-auth <1.7.0`.
   Don't bump `better-auth` until the adapter supports 1.7.
3. **Respect reduced motion** (decision 22). Every animation must honor `prefers-reduced-motion`: Motion through
   `<MotionConfig reducedMotion="user">`, GSAP through `gsap.matchMedia()`, and WebGL renders a single still frame.
   New animations ship with their reduced-motion behavior. The root `MotionConfig` makes Motion's position, size
   and layout animations instant (fades still play), and a rule at the end of `src/styles.css` makes CSS animations
   and transitions instant (spinners with `animate-spin` keep turning). Anything else, like the marquee or a Motion
   loop on a non-positional key (Shimmer's `backgroundPosition`), needs its own check. Use `FULL_MOTION` and
   `usePrefersReducedMotion()` from `src/lib/reduced-motion.ts`, and cover it in `e2e/reduced-motion.spec.ts`.
4. **Analytics never capture content** (decision 23). No prompts, replies, file contents, or keys in analytics,
   logs, or error reports. All events go through the one `track()` module and its allowlist (roadmap 1.8).
5. **Treat model output as untrusted.** Never render it as raw HTML, and never with plain `<Streamdown>`: use
   `SafeMarkdown` (or `MessageResponse` / `ReasoningContent`, which wrap it). See [security.md](docs/security.md).
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
  per slice.

## Workflow (agreed with Yash, 2026-10-26)

- **Push and open PRs without asking.** Once `bun run verify` passes (and Playwright, if the change touches UI),
  push your own branch and open a PR against `main`. Yash reviews and merges. Never merge, push to `main`, or
  force-push a branch someone else is using.
- **Lead with what needs Yash.** Final reports and PR descriptions start with a "Needs Yash" section: at most 3
  bullets (manual checks, keys, decisions), or "Nothing". Keep the rest of a report short. Yash skims long ones.
- **Owner tasks go in the roadmap.** Anything only Yash can do (accounts, keys, real-device or real-email checks)
  also goes under "Owner to-dos" in `docs/ROADMAP.md`.
- **Stay in scope.** Fix what blocks your slice. Propose anything else you find as a follow-up instead of doing it.
- **Parallel sessions.** Other slices may be in progress in worktrees under `.claude/worktrees/` (Biome ignores
  that folder). Expect small conflicts in `bun.lock`, `convex/schema.ts`, and `docs/ROADMAP.md`. Rebase on
  `origin/main` before opening the PR.
- Don't change the composer's animations or behavior (`src/components/chat/input*`) unless the slice is about it.

## Testing

- **Vitest** config is `vitest.config.ts`, deliberately separate from `vite.config.ts` (the app's plugins crash
  Vitest and keep it from exiting).
- **Convex function tests** use `convex-test` through `convex/test.helpers.ts`: `createConvexTest()` registers the
  Better Auth component, and `signIn(t, name)` seeds a Better Auth user and session and returns a client acting as
  them. Files with two dots (`*.test.ts`, `test.helpers.ts`) are never deployed by Convex.
- **Playwright** (`e2e/`, config `playwright.config.ts`) builds the app with `VITE_E2E=true` and runs it on :4174
  against `e2e/support/convex-stub.ts`, a local stand-in for Convex and Better Auth where everyone is signed out.
  No secrets or network needed.
- **Test pages** under `src/routes/e2e/` render components without a session (`/e2e/composer`). They exist in
  `bun run dev` and in `VITE_E2E` builds, and 404 in normal production builds. Add a page there when a test or a
  preview needs a component that normally sits behind sign-in.
- Import `test` and `expect` from `e2e/support/fixtures.ts`, not `@playwright/test`. Its automatic guards fail a
  test on any request that leaves the machine, any uncaught page error, or any CSP violation (report-only ones
  too). A test that provokes violations on purpose sets `test.use({ allowCspViolations: true })` and reads the
  `cspViolations` fixture. XSS payloads for model output live in `src/routes/e2e/-xss-payloads.ts`.
- **Screenshots**: baselines are per platform (`*-chromium-darwin.png` for local Macs, `*-chromium-linux.png` for
  CI). After an intentional visual change, refresh both: `bun run test:e2e --update-snapshots` and
  `bun run test:e2e:linux --update-snapshots`, then look at the new images before committing them.

## Gotchas (learned in Phase 0)

- **Biome skips this repo when it sits under `.claude/`** (`biome.json` ignores `.claude`, which also matches a
  worktree's own path), so in a worktree `bun run check` and the pre-commit hook check nothing. Lint there with a
  copy of `biome.json` minus the `!!**/.claude` line: `bunx biome check --config-path=<dir with that copy> src e2e`.
- **Keep `convex` at 1.46 or newer.** `CONVEX_DEPLOY_KEY` can deploy but not read data. Older CLIs read table sizes
  when a push drops an index, so production builds failed with "You do not have permission to perform this operation
  (deployment:data:view)". Upgrade the CLI rather than giving the key data access.
- **Vite 8 uses Node-style CJS interop** (the package is `"type": "module"`): a default import of a CommonJS
  module is `module.exports`, even with `__esModule`. "Element type is invalid … got: object" usually means a
  `.default` unwrap is needed (see `src/components/ui/shadcn-io/marquee/index.tsx`).
- **`vite.config.ts` filters out one devtools sub-plugin** (`@tanstack/devtools:event-client-setup`). In
  `@tanstack/devtools-vite` 0.8.1–0.8.5 it runs `bun outdated` on every `package.json` change, which itself
  touches `package.json`, so dev reloads every tab about 10 times a second. Keep the filter until upstream fixes it.
- `src/routes/__root.tsx` has a `@ts-expect-error` for an upstream `@convex-dev/better-auth` `AuthClient` type bug.
  tsc flags it as unused once upstream fixes it; then delete it.
- **Import Zod only from `@/lib/zod`** (Biome's `noRestrictedImports` enforces it). Zod 4 compiles schemas with
  `new Function`, which the CSP forbids, and since 4.6 it probes for eval when an object schema is *created*.
  `src/lib/zod.ts` turns jitless mode on before any importer can create a schema, whatever order the bundler
  evaluates chunks in. A single "first import" in `router.tsx` stopped being enough once chunks loaded earlier.
- **Nitro's dev server 404s requests with `Sec-Fetch-Dest: report`** (it treats them as static assets). The
  `cspReportsInDev` plugin in `vite.config.ts` relabels CSP reports so they reach `/api/csp-report` in dev.
- **In `__root.tsx`, keep `headers` after `beforeLoad`.** TypeScript infers the route context in key order;
  placed earlier, `beforeLoad`'s return type is lost.
- **New package versions wait 3 days** (`bunfig.toml` `minimumReleaseAge`). For an urgent fix, pass
  `--minimum-release-age=0` and say why in the PR. `trustedDependencies` is empty on purpose: no dependency
  lifecycle scripts run.
- **Vercel installs from an empty `node_modules`** (`installCommand` in `vercel.json`). Its build cache once kept a
  stale `node_modules` after a dependency bump: `@convex-dev/better-auth`'s nested `semver` 7 went missing, and
  `convex deploy` failed with `Could not resolve "semver/functions/lt.js"`. Preview builds don't run
  `convex deploy`, so only production saw it. `--frozen-lockfile` also makes Vercel fail instead of silently
  re-resolving if its Bun (1.3.x, older than local 1.4) can't follow `bun.lock`.
- `ai` 7 no longer re-exports `LanguageModelV*` types, so `reasoning-middleware.ts` derives its model type from
  `wrapLanguageModel`.
