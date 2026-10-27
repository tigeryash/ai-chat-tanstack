# Roadmap

Goal: a Vercel-AI-Playground-style app. Several chat panes side by side, each with its own model,
covering hosted models, local models (LM Studio / Ollama / in-browser), voice, and tools/agents.
Users bring their own keys or local models. Chats are saved locally first, with optional cloud sync.
Today it's a portfolio piece, but it's built to production standards.

Related docs: [audit-2026-10.md](./audit-2026-10.md) (findings), [security.md](./security.md) (threat model and rules).

## How to use this file

Each numbered item is a **slice**: small enough for one agent session, and shippable on its own.
Every slice has a "Done when" line. That's the acceptance check to run before marking it done.
Tick slices off here as they land so the next session knows where things stand.

Critical path: **Phase 0 → 1 → 2 → 3**. Phases 4 (tools/agents) and 5 (voice) can start any time after
Phase 1 and interleave with Phase 3. Phase 6 (cloud) comes after the local-first core is solid. Phase 7 is launch prep.

## Milestones (agreed 2026-10-20)

Each milestone is deployable and demo-able on its own, so the portfolio piece is live long before everything is built.

1. **Playground MVP:** Phase 0, 1.0–1.5, 2.1–2.3, 3.1–3.2. Bring your own keys or LM Studio, pick models from the
   live catalog, chat in 2–4 synced panes, chats saved on your device.
2. **Serious playground:** 1.6–1.8, 2.4–2.5, 3.3–3.6, 3.10. Attachments, branching, per-model settings, cost and
   speed stats, prompt library with versions, tab status and notifications.
3. **Agents:** Phase 4, starting with the 4.0 design session.
4. **Voice:** Phase 5.
5. **Cloud and launch:** Phases 6 and 7.

## Owner to-dos (Yash)

- [x] Buy a domain. Needed for stable auth and email links, and for the separate sandbox subdomain (4.8).
  *Bought and connected 2026-10-23:* `www.highelollms.com` serves the app (the apex redirects to `www`), prod
  Convex `SITE_URL` points at it, and the Discord, Google, and GitHub OAuth redirect URLs use it. Sign-in works only
  from that origin now, not from `ai-chat-tanstack.vercel.app`.
- [x] Separate dev and prod Convex deployments before Milestone 1 goes live. *Checked 2026-10-23:* the production
  site talks to a different Convex deployment (`small-marmot-598`) than `.env.local`.
- [x] Deploy Convex with the app. Vercel's build used to run only `vite build`, so production Convex functions
  changed only when someone ran `bunx convex deploy`. *Done 2026-10-23 (PR #3):* `vercel.json` runs
  `scripts/vercel-build.sh`, which runs `convex deploy` around the Vite build only when `VERCEL_ENV=production`, and
  fails that build if the key is missing. `CONVEX_DEPLOY_KEY` is set in Vercel, Production scope only.
  *Update 2026-10-23:* the production builds for the PR #3 and PR #4 merges both failed at `convex deploy` with
  "You do not have permission to perform this operation (deployment:data:view)". convex 1.42's CLI read table
  sizes when a push drops an index, which a deploy-only key can't do (fixed upstream in 1.46). Now on convex 1.47.
  The production build for the PR #5 merge (`1591c9e`, 2026-10-23) deployed Convex successfully.
- [x] Artificial Analysis API key (free tier) for 2.1. *In `.env.local` as `ARTIFICIAL_ANALYSIS_API_KEY`
  (2026-10-23).* The 2.1 sync runs as a Convex action, so the key also has to be set on each Convex deployment
  (`bunx convex env set ARTIFICIAL_ANALYSIS_API_KEY …`). *Set on dev and prod 2026-10-26.*
- [x] A test key for manual and probe testing. `OPENROUTER_API_KEY` in `.env.local` (2026-10-26). It's Yash's
  own key: use it only for local manual tests and scripts like 2.4a, never with a `VITE_` prefix (that would ship
  it in the client bundle), and in the app enter it through the 1.1 key settings like any user. Test model:
  `google/gemma-4-26b-a4b-it:free` (free endpoints are rate-limited and may log prompts, so test with harmless text).
- [x] After roadmap 0.3 is deployed: clear the OAuth tokens already stored on Better Auth `account` rows, once per
  deployment, with `bunx convex run authMaintenance:clearStoredOAuthTokens` (dev) and the same command with `--prod`.
  It pages through the rows and schedules itself until done; re-running is harmless. Then sign in with Google,
  GitHub, and Discord on `www.highelollms.com` and link one of them to an email account, to confirm real providers
  still work with the token fields empty (tests cover this only against a stubbed GitHub).
  *Done 2026-10-25:* cleanup run on dev and prod. Google, GitHub, and Discord sign-in work on
  `www.highelollms.com`. Discord first failed with "invalid OAuth2 redirect_uri": prod's `DISCORD_CLIENT_ID`
  pointed at a different Discord app than the one with the callback URL. All deployments now use the `ai-chat-2`
  app (`1386085325612515519`). Linking a provider to an email account wasn't tried against the real providers.
- [ ] After 1.1 is deployed: on `www.highelollms.com`, Settings → API keys → Connect OpenRouter with your account,
  then "Test key" (e2e fakes OpenRouter, so the real consent page and code exchange are untried).
- [ ] After 1.3: check that prod's `activeChatSessions` and `artifacts` tables are empty
  (`bunx convex data activeChatSessions --prod`, same for `artifacts`). 1.3 dropped them from the schema; Convex
  keeps any rows but stops validating them, so the deploy is safe either way. Agents can't read prod. Clear them
  in the dashboard if they have rows. Once 1.2 has moved chat to the browser, decide whether to delete the old test
  conversations and messages on dev and prod (dev has a handful from LM Studio testing).
- [ ] After 1.2 is deployed: on `www.highelollms.com`, open `/new`, open the model picker, search
  `google/gemma-4-26b-a4b-it:free` and choose "Use … via OpenRouter" (since 2.2), and send a message (a reply should stream; reload `/<chat id>` and it's still
  there). Locally (`bun run dev`), start LM Studio's server with "Enable CORS" on, pick "Local (LM Studio)" and a
  loaded model, and check a reasoning model's thinking shows. e2e fakes both.
  *2026-10-27:* LM Studio with CORS works locally, the picker lists OpenRouter's models, and OpenRouter shows the
  connected key. The OpenRouter chat itself is still untried: the free Gemma model was rate-limited (peak hour).
- [ ] After 2.2 is deployed (production builds run `convex deploy`; preview builds use the old `models.list`, so
  their High Elo view is empty): on `www.highelollms.com`, open the model picker with OpenRouter connected. Check
  the High Elo list looks right with real scores, a model card's facts and logos, and that a model only a direct
  key serves (one OpenRouter doesn't list) says "Connect …". e2e uses a seeded catalog.
- [ ] Vercel Hobby is fine while this is a portfolio piece; move to Pro before charging money. *Still on Hobby
  (2026-10-23).*

## Key decisions

### Money, keys, and where models run
1. **Users pay for inference; the app never does.** Sources: per-provider API keys, "Connect OpenRouter" (OAuth
   PKCE, which mints a user-owned key the user can cap), the user's own AI Gateway key, and local servers.
2. **Keys never leave the browser except to their provider**, with one opt-in exception: durable agent runs
   (decision 25). Never sent to our server, Convex, logs, analytics, error reports, or URLs. Two storage modes: "this session only" (memory) and "remember on this device"
   (IndexedDB, encrypted with a non-extractable WebCrypto key; this protects against disk theft, not XSS).
   Encourage limited keys (OpenRouter credit limits, OpenAI project budgets).
3. **Model calls go browser → provider.** CORS preflights verified on 2026-10-20 for OpenAI, Anthropic (needs the
   `anthropic-dangerous-direct-browser-access` header), Google Gemini, xAI, Mistral, DeepSeek, Groq, Together,
   Fireworks, Moonshot, Cerebras, OpenRouter, Hugging Face router, and AI Gateway. There is no inference route on
   our server, so there are no inference costs, no server timeouts for chat, and no rate limiting needed for chat.
4. **No login wall.** Chatting needs no account, since keys and chats are local. Signing in is only for cloud
   features (sync, share, invite). This replaces the earlier "anonymous guest session" plan.
5. **Stay on Better Auth 1.6.x** until `@convex-dev/better-auth` supports 1.7 (current peer range is `<1.7.0`).
6. **Security baseline before key handling.** Because keys live in the page, an XSS bug or a malicious dependency
   means stolen keys. The baseline in [security.md](./security.md) ships before the key settings UI.

### Chat engine and storage
7. **`useChat` is the chat engine.** Each pane is one `useChat({ id })` with a browser-side `ChatTransport` that
   runs `streamText` against the chosen provider. The hand-rolled stream reader, the 250 ms Convex writes, and
   `/api/chat` all go away.
8. **IndexedDB behind a `ChatStore` interface** (Dexie). localStorage is synchronous, string-only, and capped around 5 MB.
9. **Persistent storage is requested at a meaningful moment.** Call `navigator.storage.persist()` after the first
   chat is saved (Firefox shows a prompt; Chrome decides from engagement; Safari support is partial). Show the result
   in settings. Export/import and cloud sync are the real backstops, because Safari can wipe site data after 7 days
   of Safari use without a visit to the site.
10. **Stored chats are versioned.** Every stored chat has a `formatVersion`. Loading runs it through an ordered list of
    pure migration functions up to the current version, then validates it. Each AI SDK upgrade that changes message
    shape adds one migration plus a fixture from the old version to the tests. Exports carry the same version.
11. **Who saves a reply.** The browser saves once when a reply finishes. With sync on, it also uploads the finished
    message to Convex. Convex only accepts finished messages, written by a member of that chat and attributed to them.
12. **Chat routes render in the browser** (TanStack Start `ssr: false`). Landing and `/share/$id` stay server-rendered.

### Models and settings
13. **The model catalog is synced data, not code.** A daily Convex cron pulls the public AI Gateway catalog and
    Artificial Analysis scores, merges a curated overrides file, and upserts a `models` table read through a public
    query. A model is *runnable* for a user when one of their connections serves it.
14. **Every model is usable; "High Elo" is the default view.** The picker opens on top-N by Artificial Analysis
    Intelligence Index plus curated pins, with an "All models" toggle and a High Elo badge. Vanished models are
    marked `removed` (never deleted): old chats stay readable, and a banner suggests the newest model from the
    same family.
15. **Settings come from capabilities.** One parameter registry (label, control, range, default, mapping to AI SDK
    call settings or `providerOptions`). The UI renders only what the model supports, and the transport strips the rest.

### Multi-pane behavior
16. **Re-syncing panes just sends.** Panes never see each other's history. A "diverged" badge shows when synced
    panes have different histories, so comparisons aren't silently apples-to-oranges.
17. **Attachments are checked when attached, not at send time.** If a synced pane's model can't take the file, that
    pane's composer shows an inline notice with a choice: send text only, send extracted text (PDFs), or skip that pane.
18. **Stop:** the composer's Stop stops all synced panes; each pane's own Stop stops just that pane. Unsynced panes
    stop individually.
19. **System prompts:** shared by default. Precedence is pane override → model-specific default → shared prompt.
    A prompt library stores named, tagged prompts (3.6).

### Cross-cutting
20. **Sharing and invites.** Single chats can be shared read-only and can become group chats. Multi-pane
    workspaces can be shared read-only but never accept invites. Shared snapshots exclude the system prompt unless the
    owner opts in.
21. **One UI primitive layer: Base UI**, with shadcn's AI Elements patterns replacing Vercel's ai-elements. The app
    shell stays a basic skeleton styled by those components; a design pass happens only when a screen needs one.
22. **Reduced motion is respected everywhere.** `<MotionConfig reducedMotion="user">` at the root, `gsap.matchMedia()`
    for GSAP, and a single static frame for the WebGL scene. Agents must keep this rule (it goes in `CLAUDE.md`).
23. **Analytics never capture content.** No prompts, replies, file contents, or keys. One `track()` module enforces
    this. Cookieless by default, with an opt-out in settings. Users get their own insights computed locally (3.9).
24. **Legal pages are drafted from a living data inventory.** [data-inventory.md](./data-inventory.md) is updated by
    any slice that adds, moves, or stores data, and its "Commitments" section is the seed of the privacy policy.
    Terms and privacy drafts start early and get revised as features land (7.1).

### Agents
25. **Durable agent runs may hold a key server-side, opt-in only.** To run a long agent on the server, the user
    provides a key for that run. It's stored encrypted in Convex, readable only by the run, and **deleted
    automatically when the run ends** unless the user ticks "keep for future runs" (then deletable any time from
    settings). The opt-in screen recommends a dedicated, spend-limited key and links to that provider's key page so
    they can revoke it afterwards. Details in [security.md](./security.md).
26. **Permission modes, not a single YOLO switch.** Modes range from "ask every time" to "auto-approve everything"
    (YOLO). YOLO only skips confirmations. It never disables the enforcement layers (CSP, sandbox origin, SSRF
    proxy, rate limits) or the hard-blocked actions. Details in [security.md](./security.md).

---

## Phase 0: Stabilize and add guardrails

- [x] **0.1 Green build on the new deps.** Patch the vendored ai-elements type errors minimally (replaced in 0.7);
  fix `reasoning-middleware.ts` (`LanguageModelV3` import), Better Auth client typing in `__root.tsx`,
  `streamAssistantTurn.ts`, `models.tsx`, and `slot.tsx`. Delete `src/routes/demo/*`, `src/hooks/useChatMessages.tsx`,
  and unused ai-elements files.
  *Done when:* `bunx tsc --noEmit` and `bunx biome check` pass; app runs; a chat with LM Studio streams.
  *Status (2026-10-20):* tsc, Biome, and `bun run build` pass; the login page renders in dev and in the production
  preview. The stream path (`/api/chat` logic, `<think>` middleware, `streamAssistantTurn`) streams from LM Studio
  (`google/gemma-4-26b-a4b`): reasoning and text arrive as separate live parts. Not yet tried from the signed-in UI. Notes:
  `@lobehub/icons` stays on 2.48.0 (5.x needs `@lobehub/ui@5` + `antd@6`); `__root.tsx` carries a
  `@ts-expect-error` for an upstream `@convex-dev/better-auth` type bug; Vite 8's Node-style CJS interop needed a
  `.default` unwrap for `react-fast-marquee` and `ssr.noExternal` for `@lobehub/*`.
- [x] **0.2 React Compiler actually on.** `@rolldown/plugin-babel` + `reactCompilerPreset()`.
  *Done when:* no `vite.config.ts` type error, and React DevTools shows the "Memo ✨" badge.
  *Status (2026-10-20):* no type error; compiler output (`react.memo_cache_sentinel`) is in 9 of 17 client chunks.
  The DevTools badge itself wasn't checked.
- [x] **0.3 Convex security fixes** (audit items 1–7): read-only user lookup in queries; attachment ownership checks;
  restrict message writes to members and their own authorship; make `usage.record` internal; crypto share IDs and a
  projected `getShared`; `type="password"` with matching min length; no stack traces or devtools in prod; drop the
  message `console.log`. Stop storing OAuth access/refresh/id tokens (sign-in is the only use): null them in a
  Better Auth `databaseHooks.account` create/update hook, and clear the existing rows.
  *Done when:* each item has a test or a manual repro that now fails safely, and Google/GitHub/Discord sign-in and
  account linking still work with the token fields empty.
  *Status (2026-10-23):* related fix outside the list: with `BREVO_API_KEY` or `EMAIL_FROM_ADDRESS` unset,
  `convex/email.ts` used to log the whole email (verification/reset link included); it now throws, and
  `convex/emailGuard.ts` answers email sign-up and reset requests with a 503.
  *Status (2026-10-25):* all items done; each has tests (`convex-test` 0.0.62 for Convex functions, helpers in
  `convex/test.helpers.ts`), and 21 of the new Convex tests fail against the old code.
  (1) `getCurrentUser`/`getCurrentUserOrNull` are read-only and typed with `QueryCtx`, so a write in a query no longer
  compiles. Only `users.getOrCreate` creates or refreshes the row (`upsertCurrentUser`). Before, a brand-new user's
  first query threw.
  (2) Only an attachment's uploader can link, move, or delete it. `sendUserMessage` links only your own unlinked
  uploads, and `attachments.create` rejects storage IDs that don't exist or are already claimed.
  (3) A message's parent must be in the same conversation (before, any user could deactivate branches in someone
  else's chat). `updateAssistantMessage` is limited to the member who started the reply, and only while it's pending or
  streaming. Its `usage` argument is gone. Feedback, cancel, edit, and delete are author-only and need current
  membership. `usage.record` is internal (merged with the old `recordInternal`).
  (4) Share IDs are 22 characters from `crypto.getRandomValues` (`convex/lib/shareId.ts`). `getShared` and
  `getSharedMessages` return only what a viewer renders, and a fork no longer copies the system prompt. Links made
  before this keep their old ID until regenerated (there's no sharing UI yet, so probably none exist).
  (5) The login password field is `type="password"` with `autocomplete`, and the client limits come from
  `convex/lib/passwordPolicy.ts`, shared with Better Auth (8–128). Also found: a login submitted before hydration went
  out as a native GET with the password in the URL. The form is now `method="post"` (e2e test with JavaScript off).
  (6) The router's error screen shows a stack only in dev. Devtools were already absent from production:
  `@tanstack/devtools-vite` strips them on build (`removeDevtoolsOnBuild`). Building before and after showed no
  devtools code in `.vercel/output`, and with stripping off the production server doesn't start, so it can't slip
  through quietly. `/api/chat` no longer logs messages; errors log only the error name and return a generic message.
  Audit item 7 (rate-limiting `/api/chat`) is moot: the route is deleted in 1.2, and the model isn't client-selectable.
  OAuth tokens: `databaseHooks.account` (`dropOAuthTokens` in `convex/lib/oauthTokens.ts`) nulls access, refresh, and
  ID tokens and their expiries on every account write. A test drives Better Auth's real GitHub callback against
  stubbed GitHub endpoints for sign-up, a repeat sign-in, linking on sign-in, and linking from a session: all sign in
  with the fields empty, and without the hook all four store the tokens. Google and Discord use the same callback
  code but weren't tried against the real providers (owner to-do). `authMaintenance:clearStoredOAuthTokens` clears
  existing rows and hasn't been run. Also, `onPasswordReset` no longer turns a successful reset into an error when
  the confirmation email fails (`sendPasswordChangedNotice`).
- [x] **0.4 Guardrails for agent-built code.**
  - `CLAUDE.md`: commands, architecture, conventions, and the hard rules (decisions 2, 5, 22, 23).
  - Vitest working, with a first unit test (`conversions.ts`).
  - Playwright with a smoke test and screenshot tests of the composer's expanded and collapsed states. Chat e2e
    tests use the AI SDK mock model from `ai/test`, so they never call a real model.
  - `bun run verify` (tsc + biome + vitest) and a pre-commit hook running Biome and the type check.
  - GitHub Actions running `verify` and Playwright on PRs.
  - `.claude/launch.json` so agents can open the app in the preview browser.
  - Keep `docs/data-inventory.md` current (started 2026-10-20).
  *Done when:* CI is green on a PR, and a deliberately broken commit is blocked by the hook.
  *Status (2026-10-23):* CI green on [PR #2](https://github.com/tigeryash/ai-chat-tanstack/pull/2). `CLAUDE.md`
  added. Vitest has its own `vitest.config.ts` (the app's Nitro/Start plugins caused the "module is not defined"
  crash and the hang), with 11 tests for `conversions.ts`. Playwright 1.64.1: smoke tests (signed out, `/` and
  `/new` land on `/login`), composer behavior tests, and pill/card screenshots with macOS and Linux baselines.
  Signed out, tests reach the composer through `/e2e/composer`, a test page that exists only in dev and
  `VITE_E2E` builds (404 in production). e2e runs a production build against a local Convex/Better Auth stub, so no
  test account, secrets, or auth changes were needed. A fixture fails any test whose page sends a request off the
  machine or throws. No chat e2e yet: today's chat path needs a session and goes away in 1.2, which adds the first
  one on `MockLanguageModelV4`. The Husky pre-commit hook (Biome on staged files + tsc) blocked a deliberately
  broken commit. CI runs `verify` and Playwright (in the same `mcr.microsoft.com/playwright` image as
  `bun run test:e2e:linux`). `.claude/launch.json` kept as is; nothing new stores data.
- [x] **0.5 TanStack Start stable.** 1.168 RC → 1.169.x per "Migrate from the Release Candidate". Vite 8 and
  `nitro/vite` are already done; `useSession` and `.inputValidator()` aren't used outside the demo routes. Re-test the
  Better Auth SSR token flow (`@convex-dev/better-auth/react-start` uses `getRequestHeaders`).
  *Done when:* login → chat works in `bun run build && bun run serve`.
  *Status (2026-10-20):* on `@tanstack/react-start` 1.169.3 / `react-router` 1.170.45. In the production preview
  the signed-out SSR path works (`/` → `/login`, `/api/auth/get-session` → `null`, `/api/chat` → 401). A signed-in
  login → chat still needs a manual pass with a real account.
- [x] **0.6 Commit the dependency upgrade** with 0.1 and 0.5 so `main` builds.
  *Status (2026-10-20):* committed on branch `phase-0-green-build`; merged to `main` as
  [PR #1](https://github.com/tigeryash/ai-chat-tanstack/pull/1).
- [x] **0.7 Base UI + shadcn AI Elements** (decision 21). Base UI style in `components.json`, re-add the shadcn
  components in use, rebuild the ai-elements wrappers in use on shadcn's patterns (each has a migration prompt; export
  names and props stay the same), move the login form to `@base-ui/react`, remove `@radix-ui/*`.
  *Done when:* no `@radix-ui` imports remain and the composer, reasoning, and auth pages look and animate the same.
  *Status (2026-10-25):* `components.json` uses `base-vega` (the Base UI build of the new-york look). Button,
  Button Group, Separator, Collapsible, and Tooltip were re-added on `@base-ui/react` 1.9 with shadcn 4.22.1, plus
  Message, Bubble, Trace, and Message Scroller for the patterns. The 14 shadcn components nothing imported (Dialog,
  Dropdown Menu, Hover Card, Select, Scroll Area, Command, Carousel, ...) were deleted; re-add them with
  `bunx shadcn add` when a slice needs them. Their Base UI versions all exist: Hover Card is built on Base UI's
  Preview Card, and Context Menu and Toast are Base UI components, so there are no gaps.
  The ai-elements wrappers follow the AI Elements migration prompts and keep their exports and props:
  `message.tsx` on Message, Bubble, and Tooltip; `actions.tsx` re-exports its `MessageActions`/`MessageAction`;
  `reasoning.tsx` on Trace (the streaming title uses the Trace `shimmer` utility instead of our Shimmer, so
  `shimmer.tsx` is deleted); `conversation.tsx` on Message Scroller (`@shadcn/react`) instead of
  `use-stick-to-bottom`, with each message wrapped in a `MessageScrollerItem` and the person's as scroll anchor.
  Reasoning keeps its old icon and wording ("Thinking...", "Thought for N seconds") and its open/close behavior,
  except that once the person opens or closes it, it no longer closes itself. The auth forms import
  `@base-ui/react`. Removed: every `@radix-ui/*` package, `@base-ui-components/react`, `use-stick-to-bottom`,
  `cmdk`, `embla-carousel-react`, and the `ai-elements` CLI package.
  Choices worth knowing: components still import `cn` from `@/lib/utils` (shadcn now imports it from its `cn`
  package; switching is a separate dependency decision). `shadcn/tailwind.css` (the `data-open:`-style variants and
  the `shimmer`/`scroll-fade` utilities the components use) is vendored as `src/shadcn-tailwind.css`, because the
  `shadcn` package that ships it brings about 250 packages. One `TooltipProvider` at the root keeps tooltips opening
  without delay, and `TooltipContent` keeps Radix's `sideOffset` of 0.
  Checks: `grep -r "@radix-ui" src package.json` finds nothing; `bun run verify` passes; Playwright passes on macOS
  with no screenshot changes. In the Linux image (emulated on Apple silicon) 55 of 57 passed, Linux screenshots
  included; the two failures are timing flakes: the login resend test passed 4 of 4 on rerun, and "the composer's
  tooltip fades in" failed 8 of 8 on `main` in the same setup (3 of 4 passed on this branch). CI runs native x86. `/e2e/loading` now shows a streaming and a finished Reasoning, and the reduced-motion
  shimmer test checks `-webkit-text-fill-color`, which is how the Trace shimmer hides text. In the e2e build the
  composer tooltip, the Reasoning open/close, and the login page were checked by eye. The chat thread itself sits
  behind sign-in, so `MessageScroller` was only type-checked, not tried with a real conversation.
- [x] **0.8 Reduced motion** (decision 22). Also cap the WebGL DPR and lazy-load three.js on the auth route.
  *Done when:* with "Reduce motion" on in the OS, the composer resizes without animating, GSAP reveals are instant,
  and the WebGL scene is a still frame.
  *Status (2026-10-25):* `<MotionConfig reducedMotion="user">` wraps the app in `__root.tsx`. Motion 12.42 then
  makes size and layout animations instant, so the composer needed no changes. Every GSAP reveal on the auth pages
  runs inside `gsap.matchMedia().add(FULL_MOTION, …)`; with reduced motion they never start and the content renders
  at rest. The model strip (marquee) also stops. The WebGL scene switches to `frameloop="demand"` and holds the
  animation's first frame, its DPR is capped at 1.5, and it is lazy-loaded after hydration inside a boundary that
  falls back to the plain background. The auth route chunk went from 294 kB to 57 kB gzipped (three.js is now its
  own 237 kB chunk). Cost: `MotionConfig` pulls Motion's core (~40 kB gzipped) from the composer chunk into the main
  chunk. Helpers are in `src/lib/reduced-motion.ts`. `e2e/reduced-motion.spec.ts` checks all three "Done when"
  points with `reducedMotion: "reduce"`, and each has a full-motion twin. No screenshot baselines changed.
  *Follow-up (2026-10-25):* a `prefers-reduced-motion: reduce` rule in `src/styles.css` makes CSS animations and
  transitions instant (tw-animate-css enter/exit, `hover:scale-105` on the auth buttons). `animate-spin` is exempt,
  because a stopped spinner no longer shows that work is happening. The "Thinking..." Shimmer renders still text
  under reduced motion, and the auth layout's footer fade now targets `.footer`, so it plays under full motion.
  New e2e cases (with twins) cover the hover scale, the composer tooltip, the Shimmer (`/e2e/loading`), spinners,
  and the footer fade.

## Phase 1: New chat core (BYOK, browser-direct, local-first)

- [x] **1.0 Security baseline** ([security.md](./security.md) "Baseline"): strict CSP with nonces and a
  `connect-src` allowlist, security headers, hardened markdown rendering, dependency hygiene, a log/analytics
  scrubber, and Playwright tests with XSS payloads in model output.
  *Done when:* the XSS tests pass and the CSP report shows no violations in normal use.
  *Status (2026-10-25):* The strict CSP (per-request nonce, `'strict-dynamic'`, `connect-src` limited to us,
  Convex, the 14 providers from decision 3 and `localhost`/`127.0.0.1`) ships as **report-only**, reporting to
  `/api/csp-report`. `object-src`, `base-uri` and `frame-ancestors` are already enforced. HSTS, nosniff,
  Referrer-Policy, Permissions-Policy, COOP and `X-Frame-Options` go on every response (`src/start.ts`, plus
  Vercel's routing config for static files). Model output renders through `SafeMarkdown`: sanitized HTML,
  `https`/`http`/`mailto` links only, remote images shown as links instead of loaded, and plain text for replies
  too big or nested for the parser (found while testing: 2,000 nested `>` crashed it, 40,000 `*_` took 4.5 s).
  `redact()` scrubs logs (`src/lib/log.ts`); `bunfig.toml` sets a 3-day minimum release age; `trustedDependencies`
  is empty; Dependabot is configured. Details and file map in [security.md](./security.md) "Where it stands".
  Fixes the policy needed: Zod's JIT (`new Function`) is off, and image compression no longer loads its worker
  from jsDelivr. Dev also needed a Vite plugin, because Nitro's dev server 404'd browser CSP reports.
  Checks: `bun run verify`; Playwright 70/70 on macOS (new `xss.spec.ts`, `csp.spec.ts`, and a guard that
  fails every test on any CSP violation), with no screenshot changes; the XSS tests fail when the hardening is
  removed. With a script that records `securitypolicyviolation` events, every signed-out page and the
  `/e2e` pages showed no violations in `bun run dev` or in a production build under `bun run serve`, and an
  injected handler's report reached the server log in both. Not covered: signed-in pages (e2e has no session),
  and Vercel itself (routing config checked in `.vercel/output/config.json` only). Linux screenshots weren't
  rerun locally; CI runs them.
  *Next:* enforce once production logs stay free of `[csp]` lines; rate-limit `/api/csp-report` with 6.2.
- [x] **1.1 Keys and connections.** Settings panel: add a key per provider, choose session-only or remember,
  "test key" (lists models), and delete. "Connect OpenRouter" via OAuth PKCE. Show which providers are connected
  and never display a full key after saving.
  *Done when:* keys work after reload in "remember" mode, vanish in "session" mode, and a network capture shows a
  key sent only to its provider.
  *Status (2026-10-26):* vault in `src/lib/keys/` (1.2 imports `getProviderKey`/`ProviderId` from `@/lib/keys`),
  settings at `/settings`; `e2e/keys.spec.ts` covers all three points with faked providers.
  [PR #24](https://github.com/tigeryash/ai-chat-tanstack/pull/24).
- [x] **1.2 `useChat` with a browser transport** (decision 7). Render every part type (text, reasoning while
  streaming, file, source, tool). Stop and regenerate. Remove `/api/chat` and `streamAssistantTurn.ts`.
  *Done when:* the route component is under ~100 lines, reasoning streams live, Stop works, and a Playwright chat
  test streams a reply from `MockLanguageModelV4` (`ai/test`).
  *Status (2026-10-27):* chat runs in the browser (`src/lib/chat/`) and saves to the 1.3 store; `/api/chat` is gone.
  PR: https://github.com/tigeryash/ai-chat-tanstack/pull/27
- [x] **1.3 `ChatStore` + IndexedDB** (decisions 8–10): Dexie store, format versioning with a migration test,
  persistent-storage request and status, export/import as versioned JSON.
  Drop the old Convex test conversations and the unused `artifacts` and `activeChatSessions` tables (pane layout
  is stored locally).
  *Done when:* chats survive reload offline; a v0 fixture loads through migration; export → wipe → import
  restores everything.
  *Status (2026-10-26):* `src/lib/storage/` (Dexie store, format migrations, persistence, export/import),
  `/e2e/storage`; unused Convex tables dropped, old test conversations left until 1.2 lands. PR: https://github.com/tigeryash/ai-chat-tanstack/pull/26
- [ ] **1.4 Sidebar.** List, new, rename, delete, pin, search by title. Auto-title with the user's chosen
  "utility model" (settings), falling back to the first line of the message.
- [ ] **1.5 No login wall** (decision 4). Chat works signed out. The auth pages become "Sign in to sync and share",
  with real sign-up and forgot-password flows (or magic link / email OTP).
  *Status (2026-10-25):* the sign-up, forgot-password and reset-password pages landed early; the login wall and the
  "Sign in to sync and share" wording are still to do. They use Better Auth's email/password endpoints and share the
  login form's parts (`src/components/auth/auth-form.tsx`: Base UI `Form`, the `FULL_MOTION` reveal, `method="post"`).
  Sign-up ends on "check your email" because verification is required, and Better Auth answers an address that
  already has an account like a new one. Forgot-password shows one message for every address. Reset-password reads
  `?token=` and `?error=INVALID_TOKEN`, and a used or expired token offers a new link. A 503 from
  `convex/emailGuard.ts` and a 429 get their own messages. Signed-in visitors are redirected from every `(auth)` page
  (the check moved from `login.tsx` to the layout route). Also fixed on login: form-level errors (wrong password,
  unverified email) were never shown, because Base UI only shows errors for named fields. Schemas are in
  `src/lib/auth-schemas.ts`, with e2e specs per page (JavaScript-off submits are POSTs with nothing in the URL), and
  `e2e/reduced-motion.spec.ts` now checks the reveal on all four pages.
  *Update (2026-10-25):* a sign-in refused with `EMAIL_NOT_VERIFIED` now offers "Resend verification email"
  (`authClient.sendVerificationEmail`, landing back on `/login`). Signed out, Better Auth answers the same for unknown,
  verified and unverified addresses, so the page shows one conditional confirmation and never names the address.
  503, 429, network and send failures get their own messages, never the server's text. `/login` reads the `?error=`
  a failed verification link adds (`TOKEN_EXPIRED`, `INVALID_TOKEN`, `USER_NOT_FOUND`, `INVALID_USER`, via
  `loginSearchSchema`) and shows its own message; any other value shows nothing. Covered in `e2e/login.spec.ts` with
  faked Better Auth answers. Known gap, server side: a Brevo rejection on resend comes back as an error only for a
  real unverified address, and a Brevo call slower than Better Auth's 500 ms floor shows in the response time.
  Not yet tried against a real deployment with Brevo.
- [ ] **1.6 Attachments that send.** Images/PDFs as `file` parts where supported; blobs in IndexedDB; unified
  drag-drop and paperclip validation; revoke object URLs.
- [ ] **1.7 Edit and branch.** Edit a user message → new branch; switch between siblings.
- [ ] **1.8 Analytics foundation** (decision 23). A `track()` wrapper with an allowlist of event names and
  properties; cookieless page analytics and Web Vitals (`web-vitals` is already installed); Sentry with scrubbing.
  From here on, each slice lists the events it adds.

## Phase 2: Models and providers

- [x] **2.1 Model catalog sync.** Convex `models` table + daily `crons.ts` action:
  1. AI Gateway `GET https://ai-gateway.vercel.sh/v1/models` (public): developer, name, description, context,
     max output, pricing, release date, knowledge cutoff, modalities, tags, supported parameters, reasoning
     options, ZDR / no-training flags.
  2. `GET /v1/models/{id}/endpoints`: which providers serve it, per-provider pricing, uptime.
  3. Artificial Analysis free API (key, 1k req/day, attribution required): intelligence/coding/agentic indices.
  4. Each provider's native model id for direct-key calls (models.dev lists per-provider ids), and OpenRouter
     `GET /api/v1/models` for its ids and finer `supported_parameters`.
  5. Merge `src/models/curation.ts` (pins, hides, display and parameter overrides).
  A failed source never wipes data. Record `lastSyncedAt` per source and log a diff each run.
  *Done when:* a manual run populates the table, and a run with one source offline leaves it intact.
  *Status (2026-10-26):* done in [PR #25](https://github.com/tigeryash/ai-chat-tanstack/pull/25). Dev holds 320 models; `models.list` / `models.get` are the public queries.
- [x] **2.1b Availability.** High Elo set, `removed` marking and banner, and per-user runnability (which of the
  user's connections can run each model; unrunnable models show "Connect <provider>").
  *Status (2026-10-27):* done with 2.2 in [PR #30](https://github.com/tigeryash/ai-chat-tanstack/pull/30) (`HIGH_ELO_COUNT` in `curation.ts`).
- [x] **2.2 Model picker + model card.** Logos, capability badges, search, filters (developer, price, context,
  capabilities), sort (Intelligence Index, price, newest), the High Elo / All toggle. Empty pane shows the model card:
  developer, description, context, prices, providers, knowledge cutoff, release date, Intelligence Index (credited),
  and data-policy badges. Local models show only what the local server reports.
  *Status (2026-10-27):* `src/components/models/`, `e2e/model-picker.spec.ts` on a seeded catalog. [PR #30](https://github.com/tigeryash/ai-chat-tanstack/pull/30).
- [ ] **2.3 Local models.** Endpoint settings for LM Studio / Ollama: test connection, list models, and keep the
  `<think>` middleware. Handle Chrome's Local Network Access prompt: explain it before it appears, and if the user
  denies it, show how to re-allow it in site settings (Chrome won't ask twice). CORS warning per [security.md](./security.md):
  warn only when the server allows every origin (`*`), with Ollama `OLLAMA_ORIGINS` instructions and a "don't show
  again" per endpoint.
  *Done when:* the deployed app chats with LM Studio on your laptop.
- [ ] **2.4a Parameter probe script.** Sends one tiny request per parameter per model with the developer's own keys
  (cents per run), records accept / reject / ignored, and writes results into `curation.ts`.
- [ ] **2.4b Parameter registry + settings panel** (decision 15), including provider-specific options and local
  sampling settings.
  *Done when:* switching models shows/hides the right controls and no supported model errors across any control's range.
- [ ] **2.5 Usage and cost display.** Tokens, TTFT, tokens/sec, and estimated cost per message, chat, and provider,
  from catalog pricing. It's the user's money, so make it visible.
- [ ] **2.6 (Stretch) In-browser models.** WebGPU (transformers.js / WebLLM) and browser built-in AI (e.g. Chrome's
  Prompt API) as extra connection types.

## Phase 3: Multi-pane playground (the signature feature)

- [ ] **3.1 Pane layout.** 1–4 resizable panes (`react-resizable-panels`), add/remove/reorder with `LayoutGroup`.
- [ ] **3.2 Synced composers + Stop** (decisions 16 and 18). Per-pane composer with a "Synced" toggle and mirrored
  input, the "diverged" badge, and the Stop behavior.
- [ ] **3.3 Capability-aware attachments** (decision 17).
- [ ] **3.4 Compare tools.** Per-pane TTFT, tokens/sec, cost; sync scroll; thumbs up/down; "copy settings to all panes".
- [ ] **3.5 Workspaces.** Save/restore layouts and models; deep link `?models=a,b,c`.
- [ ] **3.6 Prompt library** (decision 19). Save, name, tag, search, apply; set per-model defaults; version history
  (every edit is a version, with diff view and restore, and each reply records which prompt version produced it).
  Later: variables (`{{date}}`).
- [ ] **3.7 Blind mode** *(deferred; revisit with monetization)*. Hide model names, pick the better answer, reveal.
  Votes stay local and feed a personal leaderboard. Runs on the user's keys.
- [ ] **3.8 Mobile.** Panes become swipeable tabs below `md`.
- [ ] **3.9 Insights.** Local dashboard: spend per provider, latency per model, blind-mode win rates, most-used prompts.
- [ ] **3.10 Status in the tab and notifications.** The tab title and favicon reflect status (e.g. "● 2 replying",
  "✓ Done") while the tab is in the background. Browser notifications when a reply or agent run finishes or needs
  approval and the tab is hidden. Ask for notification permission only when the user first starts something long,
  never on page load. On/off per event type in settings.

## Phase 4: Agent harness

This is effectively a small agent harness. Slices below are a draft; 4.0 settles the design first.

- [ ] **4.0 Harness design session (with Yash).** Decide: which capabilities agents get and where each runs
  (browser / server / sandbox); permission modes and the hard-blocked list (decision 26); skills, plugins, and
  hooks; subagent limits; durable-run runtime (Vercel Workflow via `@ai-sdk/workflow` vs the Convex workflow
  component). Output: an ADR-style section in this file.
- [ ] **4.1 Runners.** Browser runner (default): checkpoints each step to IndexedDB, holds a wake lock, warns before
  the tab closes. Provider background mode where supported (e.g. OpenAI Responses `background`). Durable server
  runs with opt-in key custody (decision 25).
- [ ] **4.2 First tools.** Web search through provider-native search tools or the user's own search API key; a
  URL-fetch tool through a small server proxy with SSRF protection; date/time/calculator. Multi-step with `stopWhen`.
- [ ] **4.3 Permissions and approvals.** Permission modes (decision 26), per-tool risk levels, AI SDK 7 approval
  policies, and the data-flow rule from [security.md](./security.md) "Agents".
- [ ] **4.4 MCP servers.** User-added only; show and pin tool definitions, flag changes; approvals by default.
- [ ] **4.5 Skills.** Agent Skills format (a folder with `SKILL.md` instructions plus optional files) loaded on
  demand. Instruction-only skills first; skills with scripts only run in a sandbox.
- [ ] **4.6 Subagents.** A subagent is a tool that runs its own agent loop with its own context, tools, and model.
  Depth and count limits, a per-run cost estimate (it's the user's money), and the shadcn Subagent UI pattern.
- [ ] **4.7 Deep Research agent.** Plan-then-execute with tool-less "reader" subagents; progress UI; cited report.
- [ ] **4.8 Artifacts.** Rendered in a sandboxed iframe on a separate origin.
- [ ] **4.9 Hooks and plugins (later).** Declarative hooks first (e.g. "before tool X: require approval", "after
  reply: run prompt Y"); no user-supplied code outside a sandbox. Plugins bundle skills + MCP servers + hooks and
  need a trust and review story before they ship.

## Phase 5: Voice

- [ ] **5.1 Dictation (hosted).** `MediaRecorder` → `transcribe()` from the browser with the user's key →
  composer. Recording state animates the composer.
- [ ] **5.2 Dictation (on-device).** Moonshine v2 in a Web Worker (ONNX Runtime Web / WebGPU). Confirm v2 browser
  builds first.
- [ ] **5.3 Voice agent (realtime).** `experimental_useRealtime` with a session created from the user's key; tools
  via `onToolCall`; full-screen voice mode with an audio-reactive WebGL orb.
- [ ] **5.4 Voice with local models (cascade).** On-device speech-to-text → any model → text-to-speech.

## Phase 6: Accounts and cloud

- [ ] **6.1 Convex `ChatStore` + sync** (decision 11). On sign-in, offer to upload local chats. Keys never sync.
- [ ] **6.2 Abuse protection on Convex writes.** Rate limits (`@convex-dev/rate-limiter`) on sync, share
  creation, and invites; captcha on sign-up (Better Auth captcha plugin with Turnstile).
- [ ] **6.3 Sharing.** Read-only links for chats and workspaces via a server-rendered `/share/$id`, "Fork" into
  your own chats, and a report-abuse link.
- [ ] **6.3b Group chats.** Invites on single chats only; add the missing inverse check in
  `requireMultiChatConversation`. Each sender's message runs on their own key.
- [ ] **6.4 Better Auth extras.** Passkeys, magic link / email OTP, session list with revoke, account linking, 2FA.
- [ ] **6.5 (Deferred) Pro tier.** Revisit with blind mode. Idea so far: charge for software, not tokens (sync,
  sharing, team workspaces, prompt-library sync) via the Better Auth Stripe or Polar plugin.

## Phase 7: Launch prep

- [ ] **7.1 Terms and privacy.** Drafts start now from [data-inventory.md](./data-inventory.md) and are revised as
  features land. Finalize and have them reviewed before the first public sign-up (Google's OAuth consent screen
  also wants a privacy policy link when you publish).
- [ ] **7.2 Account deletion and data export** for cloud data.
- [ ] **7.3 Security review** against OWASP Top 10 for LLM Applications (2026) and for Agentic Applications, plus
  a dependency and CSP audit.
- [ ] **7.4 Accessibility audit.** Keyboard-only pass, screen reader pass with streaming replies, contrast.

## Open questions (build first, decide later)

- **Blind mode and monetization** (3.7, 6.5). Revisit later.
- **Agent harness design** (4.0): capabilities, permission modes, skills/plugins/hooks, subagents.
- **Agent memory across chats.** What's remembered, where it lives, and how users view and delete it.
- **User settings polish.** Defaults, privacy, notification preferences.
- **Other "connect an account" options** beyond OpenRouter (verify Hugging Face OAuth for Inference Providers).
- **Voice model choice** for on-device dictation (5.2).

## Out of scope for now

- Image generation / editing, video generation.
- PWA / offline shell.
- Effect (effect.website). Revisit only if server-side orchestration outgrows AI SDK + Convex actions.
