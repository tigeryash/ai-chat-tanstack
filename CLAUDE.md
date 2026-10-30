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
| `bunx knip@6.44.0` | Unused files, dependencies and exports (`knip.json`). Pinned, not in `package.json`. CI runs it. |
| `bun run test:e2e` | Playwright against a production build (macOS screenshot baselines when run on a Mac). |
| `bun run test:e2e:linux` | Playwright inside CI's Linux image via Docker. Add `--update-snapshots` to refresh Linux baselines. |
| `bun scripts/bundle-budget.ts` | After `bun run build` (add `--sourcemap` for the package check): gzipped route preloads vs the budget. CI runs it. |

The **pre-commit hook** (`.husky/pre-commit`) runs Biome on staged files and the type check. Don't bypass it with
`--no-verify`; fix the error instead. **CI** (`.github/workflows/ci.yml`) runs `verify`, knip and Playwright on every PR.
Playwright runs in 4 shards with 2 workers each (4 workers per runner made timing-sensitive tests flaky); the
`Playwright` check sums them up and passes without running e2e when a PR only touches `docs/` or `*.md`.

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
  and Start's server-function CSRF check to every response. A new provider is one entry in
  `src/models/provider-registry.ts` (its `apiOrigins` feed `provider-origins.ts`); any other third-party origin
  the browser calls goes in `csp.ts`, or the CSP reports it. `ENFORCE_STRICT_CSP` in `csp.ts` is the enforce switch.
- **Convex** (`convex/`) is the backend: `schema.ts` (the old chat tables are unused, kept until prod rows are
  checked), `users` row upsert in `authHelpers.ts`, `_generated/` is generated. Query keys go through
  `@convex-dev/react-query`. `convex/publicFunctions.test.ts` fails on any public function the app never calls as
  `api.<module>.<name>`; delete it or allowlist it there with a reason.
- **Local chats** (roadmap 1.3, `src/lib/storage/`): a `ChatStore` interface over Dexie (IndexedDB database
  `highelo-chats`). Every stored chat has a `formatVersion`; `format.ts` lists the migrations and how to add one.
  Export/import are versioned JSON in `export.ts`. Each chat has an `ownerId` (roadmap 1.9): the Better Auth user ID
  that made it, or null when made signed out. What a viewer may see is `ownership.ts`; the viewer comes from
  `src/lib/account.ts` (Better Auth's session, not Convex auth). Never list or open chats without that filter.
- **Better Auth 1.6.x** via `@convex-dev/better-auth` (server config `convex/auth.ts`, client
  `src/lib/auth-client.ts`, SSR helpers `src/lib/auth-server.ts`). Email/password plus Google, GitHub, Discord.
- **AI SDK 7, chat in the browser** (roadmap 1.2, `src/lib/chat/`). Chat routes (`/new`, `/$chatId`, both
  `ssr: false`) run `useChat` on `Chat` objects from `chat-sessions.ts`, which outlive a route (so `/new` hands a
  streaming chat to `/$chatId`) and save to the ChatStore when a reply finishes. `open-chats.ts` tracks them
  (and releases idle ones past 8; a route showing a chat calls `retainChat`). `BrowserChatTransport` runs
  `streamText` in the page against the provider in each request's `body` (`language-model.ts`; local models get
  the `<think>` middleware). Tests use `mockChatModel` (`src/lib/chat/mock-model.ts`) and the `/e2e/chat` pages; in `VITE_E2E`
  builds the local model `e2e-mock-model` is the mock too (`e2e-model.ts`), so Playwright can drive `/new`.
- **First load** (quality audit 2026-10, `scripts/bundle-budget.ts`): only chat routes may load the AI SDK, Dexie,
  GSAP or Streamdown. Route `loader`/`beforeLoad`/`validateSearch` code isn't code-split, so anything they import
  statically lands on every page: import chat code there with `import()` (see `$chatId.tsx`). The chat store
  singleton is `src/lib/storage/app-store.ts`; provider SDKs, GSAP (`src/lib/lazy-gsap.ts`) and Streamdown load on
  first use; brand logos are SVG files in `public/brand-logos/`.
- **Local models** (roadmap 2.3, `src/lib/local-endpoints/`): endpoints saved in Settings (localStorage, localhost
  and 127.0.0.1 only, to match `connect-src`); a local `ModelChoice` names its `endpoint` id. Nothing calls one
  before it's saved and the Local Network Access explainer was clicked through. e2e stubs a server with
  `context.route` (`e2e/local-models.spec.ts`); note `route.fulfill` adds a matching CORS header when you set none.
- **Model settings** (roadmap 2.4b, `src/lib/params/`): `registry.ts` defines each setting, `support.ts` decides
  which a model and host take (2.4a probe "accepted" first, then the catalog's lists from Convex `models.parameters`;
  unknown means hidden), `mapping.ts` turns them into `streamText` options and strips the rest. Each chat's
  settings sit on its ChatStore row (`lib/chat/chat-settings.ts`), the shared system prompt in the `prefs` table.
  The panel is `src/components/params/`. A React Compiler trap found here: a hook called as a method
  (`store.use()`) or a read of a mutable Map can get memoized; wrap the first in a `use…` function and make
  the second an immutable snapshot.
- **Background status** (roadmap 3.10, `src/lib/background-status/`): `chat-sessions.ts` reports every chat's
  replying/finished/failed into `activity.ts`, so the hidden-tab title, favicon and notifications cover all open
  chats (and panes). Mounted once as `<BackgroundStatus />` in the `(dashboard)` layout.
- **Analytics** (roadmap 1.8, `src/lib/analytics/`): `track()` is the only way to send an event; add new ones to
  the allowlist in `events.ts` (closed-set properties only) and to `docs/data-inventory.md`. Vercel Web Analytics
  and Speed Insights load from `<VercelAnalytics />` in `__root.tsx` in production builds only; dev and e2e record
  events in `window.__highEloAnalytics`. Settings → Analytics (and GPC / Do Not Track) turns everything off.
- **Models** (roadmap 2.1–2.2): Convex `models` table synced daily (`convex/modelCatalogSync.ts`, curation in
  `src/models/curation.ts`). The app reads `models.list` / `models.get` over HTTP (`src/lib/models/catalog.ts`), and
  the e2e Convex stub serves the seeded catalog in `src/lib/models/catalog.fixtures.ts`. Runnability per user is
  `src/lib/models/runnability.ts`; the picker, model card and removed-model banner are in `src/components/models/`.
  Each chat's model choice is kept by `src/lib/chat/chat-model-choice.ts`.
- **Design tokens** (roadmap 3.0b, direction A from [design-directions.md](docs/design-directions.md)): every
  color, font, radius and spacing step comes from `src/styles.css`, so 3.11's Appearance settings only override
  tokens. Each color token is a `light-dark()` pair: dark or light follows the system, and a `dark` / `light`
  class on an element forces it (the auth pages are always `dark`); the `dark:` variant follows the same rule.
  Use token classes (`bg-card`, `text-muted-foreground`, `text-success`, `bg-overlay/70`, `rounded-pane`), never
  palette classes or literal colors: `src/lib/design-tokens.test.ts` fails on them. Need a new color? Add a token.
  Chat panes are cards (`rounded-pane border bg-card`, in `chat-view.tsx`).
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
- TypeScript strict, no `any` unless a comment says why. Import app code through `@/` (maps to `src/`) and Convex
  code through `@convex/` (maps to `convex/`, e.g. `@convex/_generated/api`). Code inside `convex/` keeps relative
  imports.
- Named exports only, except where a tool needs a default (config files, `convex/http.ts`, `crons.ts`, `*.config.ts`).
- Features live in `src/lib/<feature>/` (logic, stores, hooks) with their UI in `src/components/<feature>/`; a
  hook sits next to the feature it serves. `src/hooks/` is only for generic ones. Older names
  (`components/chat/chatstuff/`, `src/utilities/`, `src/types/`) get renamed when next touched.
- Test data in `src/` that tests or e2e import is named `*.fixtures.ts` (`catalog.fixtures.ts`), never imported by
  app code.
- Convex functions may `console.*` names, ids and config only, never prompts, replies, emails or keys
  ([security.md](docs/security.md)).
- **knip** (`bunx knip@6.44.0`, `knip.json`, a step in CI's required verify job) fails on unused files,
  dependencies and exports. Delete them; keep an export that an open PR needs with a `/** @public */` tag naming
  the PR. It can't see unused Convex functions; `convex/publicFunctions.test.ts` does.
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
- **Data changes reach the legal drafts.** A slice that changes what data is collected, stored, or shared updates
  `docs/data-inventory.md` and flags `docs/legal/` (privacy policy, terms) in its PR's "Needs Yash".
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
  against `e2e/support/convex-stub.ts`, a local stand-in for Convex and Better Auth where everyone is signed out,
  unless a test calls `signInAs` (`e2e/support/accounts.ts`) to get a Better Auth session as a test user (Convex
  itself stays signed out). No secrets or network needed.
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
  worktree's own path), so in a worktree `bun run check` checks nothing (the pre-commit hook's `--staged` run does
  check staged files). A copy of `biome.json` elsewhere misses rules Biome turns on from `package.json` (the
  Playwright and test domains). Check like CI from a clone outside `.claude/`: `git clone -q . /tmp/x`, symlink
  `node_modules` into it, then `bun run check` there.
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
