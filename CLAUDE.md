# CLAUDE.md

AI chat app being rebuilt into a Vercel-AI-Playground-style app: several chat panes side by side, users bring
their own keys or local models, chats stored on their device first. Agents write most of the code, so the rules
and checks below are how mistakes get caught.

**Start here:** [docs/ROADMAP.md](docs/ROADMAP.md) is the plan. Work one slice per session, meet its "Done when"
line, then tick the box and add one *Status* line with the PR link (details go in the PR description, not the
roadmap). Also read [docs/security.md](docs/security.md) before touching keys, rendering, tools, local endpoints,
or Convex writes, and keep [docs/data-inventory.md](docs/data-inventory.md) current when a change stores data.

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
| `bunx knip@6.44.0` | Unused files, dependencies and exports (`knip.json`); delete them, or tag an export an open PR needs `/** @public */` with the PR. Pinned, not in `package.json`. CI runs it. Unused Convex functions are `convex/publicFunctions.test.ts`'s job. |
| `bun run test:e2e` | Playwright against a production build (macOS screenshot baselines when run on a Mac). `E2E_PORT=<n>` picks the port (default 4174); see Parallel sessions. |
| `bun run test:e2e:linux` | Playwright inside CI's Linux image via Docker. Add `--update-snapshots` to refresh Linux baselines; see `e2e/CLAUDE.md` for running it on a Mac. |
| `bun scripts/bundle-budget.ts` | After `bun run build` (add `--sourcemap` for the package check): gzipped route preloads vs the budget. CI runs it. |

The **pre-commit hook** (`.husky/pre-commit`) runs Biome on staged files and the type check. Don't bypass it with
`--no-verify`; fix the error instead. **CI** (`.github/workflows/ci.yml`) runs `verify`, knip and sharded Playwright
on every PR; the `Playwright` check passes without running e2e when a PR only touches `docs/` or `*.md`.

`.claude/launch.json` has `dev` (:3000) and `serve` (:4173) for the preview browser. Everything renders signed out.

## Architecture

- **TanStack Start 1.169** (React 19, Vite 8 with Rolldown, Nitro). File routes live in `src/routes/`;
  `src/routeTree.gen.ts` is generated, so never edit it. `src/routes/__root.tsx` fetches the auth token during SSR
  (`beforeLoad`) and wraps the app in `ConvexBetterAuthProvider`. `(dashboard)` (`ssr: false`) needs no session
  (decision 4: no login wall) and holds the sidebar (`src/components/sidebar/`, roadmap 1.4). Settings is a dialog
  over any page (`?settings=<section>`, Cmd+,; roadmap R2 S1), mounted by `SettingsHost` in `__root.tsx`, and
  `/settings` only redirects into it and serves the OpenRouter OAuth callback. `(auth)` holds login,
  sign-up, forgot and reset password (signed-in visitors go to `/new`; forms share `auth-form.tsx`). Server routes
  sit in `src/routes/api/` (`/api/auth/$` proxies to Convex, `/api/csp-report` logs CSP violations). There is no
  chat route on our server.
- **Better Auth 1.7.x** via `@convex-dev/better-auth` (server config `convex/auth.ts`, client
  `src/lib/auth-client.ts`, SSR helpers `src/lib/auth-server.ts`). Email/password plus Google, GitHub, Discord.
- **First load** (quality audit 2026-10, `scripts/bundle-budget.ts`): only chat routes may load the AI SDK, Dexie,
  GSAP or Streamdown. Route `loader`/`beforeLoad`/`validateSearch` code isn't code-split, so anything they import
  statically lands on every page: import chat code there with `import()` (see `$chatId.tsx`). Provider SDKs, GSAP
  (`src/lib/lazy-gsap.ts`) and Streamdown load on first use; brand logos are SVGs in `public/brand-logos/`.
- **Design tokens** (roadmap 3.0b, [design-directions.md](docs/design-directions.md) A): every color, font, radius
  and spacing step comes from `src/styles.css`. Each color token is a `light-dark()` pair that follows the system
  unless a `dark` / `light` class forces it (auth pages are always `dark`; the `dark:` variant agrees). Use token
  classes (`bg-card`, `text-muted-foreground`, `rounded-pane`), never palette classes or literal colors
  (`src/lib/design-tokens.test.ts` fails on them); need a new color, add a token. The composer is the one
  exception (hard rule 8). Chat panes are cards (`rounded-pane border bg-card`, in `chat-view.tsx`).
- **UI**: Tailwind 4, shadcn components on Base UI (`base-vega` style; add more with `bunx shadcn add <name>`,
  then change their `cn` import from `"cn"` to `@/lib/utils`), no Radix. `src/components/ai-elements/` keeps the
  AI SDK Elements export names but is built on shadcn's AI Elements patterns (Message, Trace, Message Scroller).
  The shadcn variants and utilities (`data-open:`, `shimmer`, `scroll-fade-*`) come from the vendored
  `src/shadcn-tailwind.css`. Motion for the composer and workspaces, GSAP and React Three Fiber on the auth pages.
  The React Compiler runs through `@rolldown/plugin-babel`, so don't add `useMemo`/`useCallback` for performance.
- **Env**: client vars are validated in `src/env.ts` (`VITE_` prefix). The server reads `VITE_CONVEX_URL` and
  `VITE_CONVEX_SITE_URL` from `process.env`. Convex's own secrets live in the Convex dashboard, not `.env.local`.

### Area notes

Each feature folder has its own `CLAUDE.md` with its details. It loads when you read files there; **read it
before changing code that uses that feature from elsewhere**, too.

| Folder | What it covers | Don't miss |
|---|---|---|
| `src/lib/settings/` | Settings dialog: section list, `?settings=` parsing, the settings registry, open/close navigation | A new setting is a registry row plus its control in `setting-controls.tsx`; the dialog loads lazily |
| `src/lib/storage/` | Local chats (Dexie `ChatStore`), ownership, Dexie version rules | Never list or open chats without the viewer from `ownership.ts` |
| `src/lib/chat/` | AI SDK chat in the browser, chat sessions, transport | Never `openChat(id)` in render for a saved chat; use `openSavedChat` |
| `src/lib/workspaces/` | Multi-pane workspaces, pane sync | Panes hold their own model choice |
| `src/lib/params/` | Per-model settings | React Compiler memoization trap |
| `src/lib/prompts/` | Prompt library, versions, diff, apply | Prompt text is content (hard rule 4) |
| `src/lib/security/` | CSP, security headers | New third-party origins go in `csp.ts` or the provider registry |
| `src/lib/models/` | Model catalog, runnability | |
| `src/lib/local-endpoints/` | LM Studio / Ollama endpoints | localhost and 127.0.0.1 only |
| `src/lib/analytics/` | `track()` and its allowlist | Hard rule 4 |
| `src/lib/error-reporting/` | Sentry, lazy-loaded behind the analytics switch, scrubbed by an allowlist | Never import `@sentry/*` statically |
| `src/lib/appearance/`, `src/lib/background-status/` | Theme overrides, hidden-tab status | |
| `convex/` | Backend, public-function guard, `convex-test` helpers | |
| `e2e/` | Playwright setup, network/CSP guards, screenshot baselines | Import `test` from `e2e/support/fixtures.ts` |

## Hard rules

1. **Keys never leave the browser except to their own provider** (decision 2). Never send a user's API key to our
   server, Convex, logs, analytics, error reports, URLs, exports, or sync payloads. Only the chat transport builds
   provider headers (plus the settings key test in `src/lib/keys/test-key.ts`); read keys only through
   `getProviderKey` from `@/lib/keys`. The single exception is the opt-in durable agent run (decision 25,
   [security.md](docs/security.md)).
2. **Stay on Better Auth 1.7.x with `@convex-dev/better-auth` 0.13** (decision 5). 0.13 requires
   `better-auth >=1.7.16 <1.8.0`. Move both together, by hand, once the adapter supports 1.8.
3. **Respect reduced motion** (decision 22). Every animation must honor `prefers-reduced-motion`: Motion through
   `<MotionConfig reducedMotion="user">`, GSAP through `gsap.matchMedia()`, and WebGL renders a single still frame.
   The root `MotionConfig` makes Motion's position, size and layout animations instant (fades still play), and the
   end of `src/styles.css` does the same for CSS (`animate-spin` keeps turning). Anything else (the marquee, a Motion
   loop on a non-positional key like Shimmer's `backgroundPosition`) needs its own check with `FULL_MOTION` /
   `usePrefersReducedMotion()` (`src/lib/reduced-motion.ts`), covered in `e2e/reduced-motion.spec.ts`.
4. **Analytics never capture content** (decision 23). No prompts, replies, file contents, or keys in analytics,
   logs, or error reports. All events go through the one `track()` module and its allowlist (roadmap 1.8).
5. **Treat model output as untrusted.** Never render it as raw HTML, and never with plain `<Streamdown>`: use
   `SafeMarkdown` (or `MessageResponse` / `ReasoningContent`, which wrap it). See [security.md](docs/security.md).
6. **Tests never call a real model.** Chat tests use the AI SDK mock model (`MockLanguageModelV4` and
   `simulateReadableStream` from `ai/test`). The e2e fixture fails any request that leaves the machine.
7. **Don't hand-edit `node_modules`.** Patches there vanish on reinstall and have broken dev before. If something
   upstream is broken, work around it in our code or config and leave a comment saying why.
8. **The composer is Yash's design.** No change to how `src/components/chat/input*` or its icons look or animate
   (buttons, icons, colors, spacing, sizes, motion) without Yash's explicit approval of a mockup or screenshot
   first, whatever the slice is about. Invisible changes (wiring, accessibility attributes, invisible bug fixes) are
   fine. Never refresh its screenshot baselines without that approval. It keeps its original colors in every theme
   (no tokens, `.composer-design` in `src/styles.css`); `e2e/composer-design.spec.ts` pins it.

## Conventions

- TypeScript strict, no `any` unless a comment says why. Import app code through `@/` (maps to `src/`) and Convex
  code through `@convex/` (maps to `convex/`, e.g. `@convex/_generated/api`). Code inside `convex/` keeps relative
  imports.
- Named exports only, except where a tool needs a default (config files, `convex/http.ts`, `crons.ts`, `*.config.ts`).
- Features live in `src/lib/<feature>/` (logic, stores, hooks) with their UI in `src/components/<feature>/`; a
  hook sits next to the feature it serves. `src/hooks/` is only for generic ones. Older names
  (`components/chat/chatstuff/`, `src/types/`) get renamed when next touched.
- Test data in `src/` that tests or e2e import is named `*.fixtures.ts`, never imported by app code.
- Convex functions may `console.*` names, ids and config only, never prompts, replies, emails or keys
  ([security.md](docs/security.md)).
- Small focused files. Match the surrounding code's naming and comment density.
- Unit tests sit next to the code as `*.test.ts`. Vitest runs in Node; a test that needs the DOM adds
  `// @vitest-environment jsdom` at the top.
- Commit messages: `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci), one branch per slice.

## Workflow (agreed with Yash, 2026-10-26)

- **Push and open PRs without asking.** Once `bun run verify` passes (and Playwright, if the change touches UI),
  push your own branch and open a PR against `main`. Yash reviews and merges. Never merge, push to `main`, or
  force-push a branch someone else is using.
- **Lead with what needs Yash.** Final reports and PR descriptions start with a "Needs Yash" section: at most 3
  bullets (manual checks, keys, decisions), or "Nothing". Keep the rest of a report short. Yash skims long ones.
- **Owner tasks go in the roadmap.** Anything only Yash can do (accounts, keys, real-device or real-email checks)
  also goes under "Owner to-dos" in `docs/ROADMAP.md`.
- **Data changes reach the legal drafts.** A slice that changes what data is collected, stored, or shared updates
  `docs/data-inventory.md` and the matching lines of `docs/legal/privacy-policy.md` (and `terms.md` if it applies)
  in the same PR, and lists the wording under "Needs Yash" for review.
- **Stay in scope.** Fix what blocks your slice. Propose anything else you find as a follow-up instead of doing it.
- **Parallel sessions.** Other slices may be in progress in worktrees under `.claude/worktrees/` or
  `~/.t3/worktrees/` (Biome ignores `.claude`). Expect small conflicts in `bun.lock`, `convex/schema.ts`,
  `docs/ROADMAP.md` and screenshot baselines. Rebase on `origin/main` before opening the PR. While running:
  - **Own ports.** Run Playwright with `E2E_PORT=<free port>` (e.g. 4200 + a number you pick; the Convex stub
    takes the next one). Never `E2E_REUSE_SERVER=1` in a parallel session: it reuses whatever already listens,
    possibly another worktree's build.
  - **One e2e run at a time per worktree.** Host and Docker runs share the build output and break each other.
  - **Finish before ending your turn.** Don't end it while a test run or build is still going; wait for it, then
    commit, push and open the PR. Report the PR URL, head SHA and check state last.
  - **Run e2e in the foreground.** Run `bun run test:e2e` (and `--repeat-each` runs) as a normal blocking command
    with the longest allowed timeout (10 minutes), not as a background job. Agents that backgrounded a run and
    ended their turn to "wait for the notification" stalled for good. A run that may take longer: split it by spec
    file or `--shard`, each in the foreground.
  - **Check a PR is open before pushing to it.** Yash merges fast; pushing to a merged PR's deleted branch
    re-creates it. Check with `gh pr view <n> --json state`.
- **Screenshots and merge order.** PRs that change the same baseline (`workspace-three-panes`, `workspace-phone`)
  conflict: the one merged second merges `origin/main` and regenerates its baselines (Linux and macOS). Say in the
  PR which baselines it changes, so the coordinator can order merges.

## Testing

- **Vitest** config is `vitest.config.ts`, separate from `vite.config.ts` on purpose (the app's plugins hang Vitest).
- Convex function tests: see `convex/CLAUDE.md`. Playwright, test pages and screenshot baselines: see `e2e/CLAUDE.md`.

## Gotchas (learned in Phase 0)

- **`biome.json` ignores `.claude` at the repo root only** (`!!.claude`), so the main checkout skips worktrees and a
  worktree checks its own files. A `**/.claude` pattern would also match a worktree's own path and check nothing.
- **Vite 8 uses Node-style CJS interop**: a default import of a CommonJS module is `module.exports`, even with
  `__esModule`. "Element type is invalid … got: object" means a `.default` unwrap (see `shadcn-io/marquee`).
- **`vite.config.ts` filters out `@tanstack/devtools:event-client-setup`**: in devtools-vite 0.8.1–0.8.5 it reloads
  dev about 10 times a second (`bun outdated` touches `package.json`). Keep the filter until upstream fixes it.
- **Import Zod only from `@/lib/zod`** (Biome enforces it). Zod 4 compiles schemas with `new Function`, which the
  CSP forbids, and since 4.6 probes for eval when an object schema is *created*. `src/lib/zod.ts` turns jitless
  mode on before any importer can create a schema, whatever order chunks load in (a "first import" wasn't enough).
- **In `__root.tsx`, keep `headers` after `beforeLoad`.** TypeScript infers the route context in key order;
  placed earlier, `beforeLoad`'s return type is lost.
- **New package versions wait 3 days** (`bunfig.toml` `minimumReleaseAge`). For an urgent fix, pass
  `--minimum-release-age=0` and say why in the PR. `trustedDependencies` is empty on purpose: no dependency
  lifecycle scripts run.
- **Vercel installs from an empty `node_modules` with `--frozen-lockfile`** (`vercel.json`): its build cache once
  broke production's `convex deploy` (#23), and its Bun (1.3.x) must fail rather than re-resolve `bun.lock`.
- `ai` 7 no longer re-exports `LanguageModelV*` types, so `reasoning-middleware.ts` derives its model type from
  `wrapLanguageModel`.
