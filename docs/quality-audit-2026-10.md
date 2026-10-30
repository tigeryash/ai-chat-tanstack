# Quality audit, October 2026

Snapshot of `main` at `4313b66` (2026-10-30, after PR #41). Read-only: no app code changed. The fixes are grouped
into slices at the end, to run after the design, settings (2.4b), analytics (1.8) and legal (7.1) sessions merge.
This is a point-in-time record like [audit-2026-10.md](./audit-2026-10.md); track the work in
[ROADMAP.md](./ROADMAP.md).

## Summary

The code in `src/lib` is in good shape. Files are small, comments say why, tests sit next to the code, and all
the hard rules hold: keys are read only by the transport and the key test, every app log goes through
`redact()`, model output renders only through `SafeMarkdown`, and stores share one validated `createLocalStore`.
Little is duplicated. The problems sit in four places:

1. **Every page downloads the chat engine.** The root route preloads 1.18 MB of JS (341 KB gzipped) on every
   page, `/login` included: the AI SDK, three provider SDKs, Dexie and GSAP. The cause is a route loader and the
   sidebar importing `chat-sessions.ts`. Fixing it should cut about half of what `/login` loads (P1, P2).
2. **The old Convex chat backend is still deployed.** It has 55 public queries and mutations (2,179 lines) that
   no app code calls, with no rate limits. One of them, `attachments.generateUploadUrl`, gives any signed-in
   account unlimited uploads to our Convex storage (D1).
3. **Streaming re-renders too much.** Each streamed chunk re-renders the chat screen, the model picker (which
   re-derives about 270 catalog rows even when closed) and every message, with no throttle. With four panes
   streaming (3.1/3.2), that's four times the work. Fix it before panes (P4).
4. **Guards have gaps.** The strict CSP (the one that stops a stolen key leaving the page) is still report-only,
   with no date or owner task to enforce it (G1). Biome doesn't lint `convex/` or `vite.config.ts` (C1), and knip
   can't see unused Convex functions (see [CI guards](#ci-guards)).

Recommended order: slice 2 (re-renders, before 3.1), slice 1 (first load), slice 3 (retire old Convex). See
[Proposed slices](#proposed-slices).

Tools run: `bunx knip@6.44.0` (no config, then the config in [CI guards](#ci-guards)), `npx react-doctor`
(score 47/100, 103 issues; most are in vendored animate-ui code and the old Convex files, the rest were checked by
hand below), `bun run build` with source maps, and a manual pass over keys, the transport, local endpoints and
Convex. The `code-review`, `simplify` and `security-review` skills review a branch's diff, and this audit has no
diff, so I applied their checklists by hand instead.

## Findings

Severity: **high** = fix soon (security or a cost on every page), **medium** = fix before the feature that leans
on it, **low** = tidy-up. Fix size: S (under an hour), M (one session), L (more than one session).

### Performance and bundle

Current build (minified / gzipped JS, from the Start manifest's route preloads):

| Route | JS it preloads |
|---|---|
| Root (every page) | 1,175 KB / 341 KB, 27 files |
| `/login` | 1,295 KB / 384 KB (plus the three.js scene, loaded lazily) |
| `/settings` | 1,363 KB / 411 KB |
| `/new`, `/$chatId` | 2,266 KB / 695 KB, 55 files |
| CSS | 137 KB / 20 KB |

Largest chunks and what's in them (share of source bytes, from the source maps):

| Chunk | Size (min / gz) | Contents | Loaded by |
|---|---|---|---|
| `scene` | 897 / 242 KB | three 74%, @react-three/fiber 25% | Auth pages, lazily (fine) |
| `reasoning` | 482 / 150 KB | Streamdown's markdown stack: hast-util-raw 28%, micromark, mdast, marked, unified | `/new`, `/$chatId` |
| `persistence` | 417 / 114 KB | `ai` 56%, Dexie 20%, provider-utils 12%, @ai-sdk/gateway 9% | **Root** |
| `chat-sessions` | 329 / 83 KB | @ai-sdk/google 41%, @ai-sdk/anthropic 35%, openai-compatible 7% | **Root** |
| `input` | 276 / 93 KB | motion-dom + framer-motion 68%, react-dropzone, file-selector, browser-image-compression | `/new`, `/$chatId` |
| `zod` | 98 / 28 KB | zod | Root |
| `index` (entry) | 91 / 31 KB | react-dom, Base UI, convex, query-core, seroval | Root |
| `chat-screen` | 84 / 30 KB | picker and host components, Base UI | `/new`, `/$chatId` |
| `auth-schemas` | 69 / 27 KB | **gsap 99%** (merged with the auth form schemas) | **Root** |
| `brand-logos` | 53 / 18 KB | inline SVG logos | Auth pages, `/new` |

No shiki or Convex-heavy chunk ships: shiki isn't imported anywhere (see D2), and Convex's client is in the entry.

**P1 (high) The root route preloads the chat engine on every page.** M.
- Files: `src/routes/(dashboard)/$chatId.tsx` (its `loader` imports `openSavedChat`; TanStack splits route
  components, not loaders, so the import lands in the root graph), `src/components/sidebar/use-chat-list.ts`,
  `src/lib/chat/chat-ownership.ts` (both import `chatStore()` from `chat-sessions.ts`),
  `src/lib/chat/language-model.ts` (static imports of all provider SDKs).
- Why: `/login` and `/settings` download about 200 KB gzipped of chat code they never run. On a phone, that's
  the slowest part of the first visit.
- Fix: (a) move the `chatStore()` singleton to `src/lib/storage/app-store.ts`, so the sidebar and ownership code
  only need Dexie; (b) in the `$chatId` loader, `await import("@/lib/chat/chat-sessions")`; (c) load provider SDKs
  in `resolveProviderModel` with `await import("@ai-sdk/anthropic")` and so on (it's already async). Check the
  result with the bundle budget below.

**P2 (medium) GSAP sits in the root bundle, and all its plugins come with it.** S.
- Files: `src/routes/(auth)/route.tsx` (`import { SplitText } from "gsap/all"`), `src/lib/auth-schemas.ts`.
- Why: Rolldown put gsap in the same chunk as the auth schemas, and `login.tsx`'s `validateSearch` pulls those
  schemas into the root graph. `gsap/all` also bundles every GSAP plugin.
- Fix: `import { SplitText } from "gsap/SplitText"`. Then give gsap its own chunk (`build.rollupOptions.output.advancedChunks`
  group in `vite.config.ts`), or keep the search schema in a module that imports nothing from the auth UI.

**P3 (medium) The markdown stack loads before there's anything to render.** M.
- Files: `src/components/ai-elements/safe-markdown.tsx`, `src/components/ai-elements/reasoning.tsx`.
- Why: an empty `/new` waits on 150 KB gzipped of parser it doesn't need until the first reply. Raw-HTML parsing
  (`defaultRehypePlugins.raw`, which brings hast-util-raw and parse5) is about a quarter of it. All raw HTML is
  sanitized away anyway.
- Fix: lazy-load `Streamdown` inside `SafeMarkdown`, with `PlainText` as the Suspense fallback (it's already the
  error fallback, so it looks fine mid-stream). Separately, decide whether to drop raw-HTML parsing (HTML in a
  reply would show as text). That's a smaller attack surface and a smaller bundle, but it's a product call.

**P4 (medium, do before 3.1) Every streamed chunk re-renders the screen, the picker and all messages.** M.
- Files: `src/components/chat/chat-screen.tsx`, `src/components/chat/chat-view.tsx` (two `useChat`
  subscriptions per chat, no `experimental_throttle`), `src/components/models/use-chat-model.ts`,
  `src/components/models/model-picker.tsx`, `src/components/chat/chatstuff/messages-list.tsx`.
- Why: `ChatScreen` reads `messages` only for `chatNeeds()`, so each chunk re-runs `useChatModel`: it searches
  271 catalog rows, rebuilds host options and Zod-parses the selection. `selection` and `choice` are new objects
  each time, so the React Compiler's memoization misses. `ModelPicker` then runs `filterModels` and `routesFor`
  over the whole catalog even while closed, and `currentModel` (built from `selection`) changes, so every
  `MessageUI` re-renders, not just the streaming one. With 3.2's synced panes this multiplies by the number of
  panes.
- Fix: (a) `useChat({ chat, experimental_throttle: 50 })` in both places, or pass `messages` and `status` down
  from one subscription; (b) work out `needs` from user messages only, so it changes when the person sends, not
  per chunk; (c) give `selection` and `currentModel` a stable identity (compare by value, or pass primitives);
  (d) build picker rows only while `open`, in a `usePickerEntries` hook. Check with React DevTools' highlight
  updates while a mock reply streams on `/e2e/chat`.

**P5 (low) Brand logos are 53 KB of inline SVG in the chat bundle.** S.
- Files: `src/components/auth/brand-logos.tsx` (619 lines), `src/components/models/model-logo.tsx`.
- Fix: static SVG files in `public/` rendered with `<img>` (cached separately, not parsed as JS), or one lazy
  import per logo.

**P6 (low) The composer loads attachment libraries up front.** S.
- Files: `src/components/chat/input/upload-file.tsx`, `drag-n-drop.tsx`.
- Why: react-dropzone and browser-image-compression load with every chat, and attachments don't send yet (1.6).
  Motion is imported in full (`motion`, not `LazyMotion` + `m`) in 10 files.
- Fix: in 1.6, `await import("browser-image-compression")` on first attach. Leave Motion alone unless a
  composer slice is approved (CLAUDE.md protects the composer).

**P7 (low) Every reply rewrites and re-checks the whole chat in IndexedDB.** M (before 6.1).
- Files: `src/lib/storage/dexie-chat-store.ts` (`saveMessages` → `writeChat` deletes and re-puts every message;
  `validateMessages` checks the full history), `src/lib/chat/chat-sessions.ts` (`saveChat` then renames in a
  second transaction).
- Why: the cost per reply grows with the chat's length, and each save fires the sidebar's `liveQuery` (twice on
  first save), which re-reads every chat row. That's fine at today's sizes, but sync (6.1) and long agent runs
  will feel it.
- Fix: write only the messages that changed (the tail since the last save), and set the title in the same
  transaction.

**P8 (low) Open chats are never released.** S.
- File: `src/lib/chat/chat-sessions.ts` (`openChats` only shrinks on delete).
- Why: every chat opened in a tab keeps its `Chat` and all its messages in memory until reload. Panes and a long
  session make this worse.
- Fix: release idle chats (not streaming, not on screen) with a small LRU.

**P9 (low, verify) The root `beforeLoad` calls a server function on every client navigation.** S.
- File: `src/routes/__root.tsx` (`getAuth()`).
- Why: on the client, a server function is a network round trip, so each route change waits on our server.
  Check in the network panel, then reuse the token from the router context on the client.

### Dead code

**D1 (high) The old Convex chat backend is deployed but unused.** M.
- Files: `convex/messages.ts`, `conversations.ts`, `groupChats.ts`, `sharing.ts`, `attachments.ts`,
  `branching.ts`, `usage.ts`, `messagePins.ts` (55 public functions, 2,179 lines, plus 497 lines of tests), the
  unused helpers in `convex/authHelpers.ts`, `users.current` and `users.updatePreferences`,
  `src/utilities/conversions.ts` (only its test imports it), and the tables `conversations`,
  `conversationParticipants`, `messages`, `attachments`, `messagePins` and `usageEvents` in `convex/schema.ts`.
- Why: the app calls only `users.getOrCreate`, `models.list` and `models.get`. The rest is public API that any
  signed-in account can call, with no rate limits (6.2 isn't built): unbounded writes to `messages`, and
  `attachments.generateUploadUrl` hands out storage upload URLs with no size or count limit, which costs us money.
  It also misleads agents: the folder looks like a working chat backend.
- Fix: delete the functions and their tests. Git history keeps them for 6.1/6.3. Then drop the tables once Yash
  confirms the prod rows can go (agents can't read prod data). Update 6.1/6.3b in the roadmap so they don't
  mention `groupChats.ts` as if it still exists.

**D2 (low) Small leftovers.** S.
- Empty `src/components/chat/chatstuff/chat.tsx`.
- `src/integrations/convex/provider.tsx`: unused, and a third place that creates a `ConvexQueryClient`.
- Unused dependencies: `@xyflow/react`, `shiki` (code blocks get no highlighting; adding it back would be
  `@streamdown/code`, lazily).
- `src/env.ts`: `SERVER_URL` and `VITE_APP_TITLE` are never set or read, and it still has the template comments.
- Unused exports: `readHostPrefs`, `resetConnectedProviders`, `createBracketThinkModel`, and the `ChatModel` and
  `AutoSort` re-exports. `PARAMETER_PROBE` waits for 2.4b.
- The composer shows Web search, Deep research, Voice input and Voice chat buttons that do nothing
  (`src/components/chat/input/*-button.tsx`). `webSearchEnabled` is toggled but never sent. Users can see them
  on the live site. Needs Yash's OK because the composer is protected; hide them until 4.2 and 5.1.

**D3 (low) Design prototypes still build into production.** S.
- Files: `src/routes/e2e/design/` (56 KB: three directions and a shared shell).
- Why: the routes 404 in production, but their chunks still sit in `.vercel/output`. Once direction A is applied
  (in progress), B and C are dead.
- Fix: delete `src/routes/e2e/design/` when the apply-design session merges, keeping any fixture the e2e pages
  still need.

**D4 (medium) A vendored icon system with compiler bail-outs.** M (needs Yash's OK: it's in the composer).
- Files: `src/components/animate-ui/icons/icon.tsx` (684 lines), `primitives/animate/slot.tsx`, `send.tsx`,
  `paperclip.tsx`, `audio-lines.tsx`.
- Why: it's 684 lines for three animated icons. React Doctor finds refs read during render, state set in effects
  and derived state in it, so the React Compiler skips it. `Slot` calls `motion.create(children.type)` during
  render, which gives a non-motion child a new component type each render (remounts).
- Fix: lucide icons with a small Motion hover on the button, or at least memoize `motion.create` per type.

### Duplication

Duplication is low. localStorage values all go through `createLocalStore`, number formatting is all in
`src/lib/models/format.ts`, and logging is all in `src/lib/log.ts`. What remains:

**U1 (medium) Provider facts live in six files.** M.
- `src/lib/keys/providers.ts` (ids, names, key pages), `src/models/providers.ts` (`NATIVE_ID_PROVIDERS`, the same
  list minus OpenRouter and Vercel), `src/lib/security/provider-origins.ts` (origins),
  `src/lib/chat/language-model.ts` (`OPENAI_COMPATIBLE_BASE_URLS`), `src/lib/keys/test-key.ts` (test URLs),
  `src/lib/hosts/use-endpoints.ts` (`OPENROUTER_API`, `GATEWAY_API`), plus the logos.
- Why: adding a provider takes six edits. Tests already check that every URL's origin is in the CSP list, so the
  risk is drift (a name or key page out of date), not a leak.
- Fix: one Convex-safe `src/models/provider-registry.ts` (no `@/` imports) with id, name, key page, API origin,
  base URL, key test and "has native ids". The other files derive from it. Do it before adding more providers.

**U2 (low) Attachments are built twice.** S, fold into 1.6.
- `upload-file.tsx` `handleUpload` and `drag-n-drop.tsx` each build a `FileObject` with their own base64 reader
  and a `Math.random()` id, and neither calls `URL.revokeObjectURL` (React Doctor: 3 leaks).
- Fix: one `toFileObject(file)` in `src/lib/attachments/` using `crypto.randomUUID()`, and revoke previews on
  remove and unmount.

**U3 (low) The Convex URL is read raw in four places.** S.
- `src/routes/__root.tsx`, `src/lib/models/catalog.ts`, `src/integrations/tanstack-query/root-provider.tsx`,
  `src/integrations/convex/provider.tsx`. CLAUDE.md says client vars are validated in `src/env.ts`, but
  `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` aren't there.
- Fix: add them to `env.ts` and read `env.VITE_CONVEX_URL` everywhere (delete the unused provider, D2).

### React

App code mostly follows good practice. There are few effects and each has a reason, keys are stable message ids,
derived values are computed in render, and stores use `useSyncExternalStore`. The React Doctor errors that
matter are P4 and D4. Also:

**R1 (low) The React Compiler skips three components because of `try`/`finally`.** S.
- `src/components/auth/auth-form.tsx:91`, `src/components/settings/provider-key-row.tsx:39`,
  `src/components/sidebar/sign-out-item.tsx:53` (React Doctor `react-hooks-js/todo`). The compiler doesn't
  support `finally` yet, so these whole components run uncompiled.
- Fix: move the async work into a `src/lib` function that returns a result, and set the pending flag after
  `await` in a `catch`. Or leave it and re-check after the next compiler release.

**R2 (low) Accessibility basics in the composer.** S (needs the composer OK).
- The icon-only buttons (`web-search-button.tsx`, `deep-research-button.tsx`, `voice-input-button.tsx`,
  `upload-file.tsx:85,103`) have tooltips but no accessible name. The textarea's only label is its placeholder
  (`text-input.tsx:35`), and a file chip nests a button inside a button.
- Fix: `aria-label` on each button, a visually hidden label on the textarea, and one button per chip.

**R3 (low) Large components.** M, with P4.
- `model-picker-list.tsx` 331 lines, `run-with.tsx` 301 (`RunWith` is flagged for complexity),
  `host-details.tsx` 266, `model-picker.tsx` 265, `provider-key-row.tsx` 249, `upload-file.tsx` 244,
  `(auth)/route.tsx` 225. Only `ModelPicker` and `RunWith` mix a lot of derivation into render. Move it into hooks
  (`usePickerEntries`, `useRunWithRows`) when P4 touches them. The rest are long only because of markup.

**R4 (low) `Reasoning` tracks its duration with effects.** S.
- `src/components/ai-elements/reasoning.tsx:89-99` sets `startTime` and `measuredDuration` from effects. A ref
  for the start time, set when streaming begins, would drop a render. It's the upstream AI Elements pattern, so
  it's only worth doing if that file is touched anyway.

### Consistency with CLAUDE.md

Hard rules, checked: **keys** are read only in `browser-transport.ts` and `provider-key-row.tsx` (the key test);
they're encrypted with a non-extractable AES-GCM key bound to the provider id, and every vault key is registered
with `redact()`. **Untrusted output:** `<Streamdown>` appears only in `safe-markdown.tsx`, and there's no
`dangerouslySetInnerHTML`. **Reduced motion:** the infinite loops are transform-based (`audio-lines.tsx`), which
the root `MotionConfig` makes instant. **Analytics:** no events yet (1.8 is in progress).

**C1 (medium) Biome doesn't lint `convex/` or `vite.config.ts`.** S, but a big diff.
- `biome.json` `files.includes` lists `src`, `e2e`, `scripts` and a nonexistent `vite.config.js`. So `convex/`
  (about 6,800 lines) uses 2-space indents, mixed quotes and stray spaces (`v. string()`, `args. id`), and
  `vite.config.ts` uses single quotes, both against the conventions. Lint rules don't run there either.
- Fix: add `**/convex/**/*.ts` (minus `_generated`) and `**/vite.config.ts`, then run `bun run fix` once. Do it
  after D1, when no session is editing Convex.

**C2 (low) Conventions that aren't written down yet.** S (CLAUDE.md edits).
- **Exports:** 47 component files use named exports and 10 older ones use `export default` (`chatstuff/*`,
  `auth/*`, `drag-n-drop.tsx`). Suggest: named exports only, except where a framework needs a default.
- **Folders:** pre-rebuild names like `src/components/chat/chatstuff/`, `src/utilities/`, `src/types/types.ts`,
  and `src/components/auth/models.tsx` (the 3D scene, easy to confuse with the model catalog). Suggest: features
  under `src/lib/<feature>/`, shared hooks next to their feature, and rename these when they're next touched.
- **Test fixtures in `src/`:** `src/lib/models/test-catalog.ts` and `src/lib/hosts/test-endpoints.ts` serve
  e2e only. Suggest a `*.fixtures.ts` suffix, so readers (and knip) know.
- **Convex imports:** `../../../convex/_generated/api` appears in two files. A `@convex/*` path alias would match
  the `@/` rule.
- **Convex logging:** `convex/` uses `console.*` directly (`email.ts`, `hideAccountExistence.ts`,
  `modelCatalogSync.ts`). security.md allows it ("names and config only"), but CLAUDE.md should say so.

### Over-engineering and gaps

Most abstractions earn their keep: `ChatStore` (a Convex version is planned), the injectable `resolveModel`
(tests), and `createKeyVault(getStore)` (tests). The one that doesn't is D4's icon system. The unused
`MessageBranch*`, `MessageAttachment*` and `MessageToolbar` exports in `ai-elements/message.tsx` wait for 1.6 and
1.7, so keep them.

**G1 (medium) The strict CSP is still report-only, and nothing says when that changes.** S.
- Files: `src/lib/security/csp.ts:100`, docs/security.md ("To enforce: … once production logs show no `[csp]`
  lines").
- Why: keys live in the page. The report-only `connect-src` is what would stop an injected script sending a key
  to another server, and it isn't enforced. The roadmap's *Next* line says "enforce" but there's no owner to-do,
  so it can wait forever.
- Fix: an owner to-do to check Vercel's logs for `[csp]` lines after a week of real use, signed in. Then a
  one-line change that enforces the strict policy, keeping a report-only copy for any new directive.

**G2 (low) Missing tests for shared risky code.** S.
- `src/lib/local-store.ts` (the validated store behind 8 settings) has no unit test.
  `src/lib/keys/use-connected-providers.ts` caused the first-key-save bug fixed in PR #40 and still has only e2e
  coverage.

**G3 (low) Local servers have no timeout or size cap.** S.
- Files: `src/lib/local-endpoints/list-models.ts`, `test-connection.ts`.
- Why: a server that never answers leaves "Test connection" and the picker's Local group spinning. A huge list
  renders every id, and an id over 200 characters can't be saved as a `ModelChoice`, so picking it fails without
  saying why.
- Fix: `AbortSignal.timeout(5000)`, keep the first 1,000 ids, and drop ids over the `ModelChoice` limit.

### Security spot-check

Checked: the key vault, redaction, the chat transport, `language-model.ts`, the key test, OpenRouter OAuth,
`SafeMarkdown`, local endpoints, and the Convex functions. What holds:
- Keys go only into their own provider's client. Google's key is sent in a header. The Anthropic browser header
  is documented.
- Local endpoints are limited to `localhost` / `127.0.0.1` on save and when read, to match `connect-src`. Fetches
  use `credentials: "omit"` and send no referrer.
- Markdown links and images are allowlisted, and remote images never load on their own.
- `/api/csp-report` caps the body at 64 KB and 20 reports. Rate limiting waits for 6.2.
- `models.list` and `models.get` are read-only. `users.getOrCreate` needs a session.

What doesn't hold: **D1** (unused public mutations, including unlimited storage uploads) and **G1** (CSP not
enforced). G3 is about robustness, not a vulnerability.

## Proposed slices

Each can run after the current design, 2.4b, 1.8 and 7.1 sessions merge. Slices 1 and 2 touch different files
and can run in parallel. Slice 4 should follow slice 3.

1. **Lean first load** (P1, P2, P3, P5, plus the bundle-budget CI step). M.
   *Done when:* the root preload is at most 180 KB gzipped, `/login` has no `@ai-sdk/*`, `dexie` or `gsap` in its
   preloads, and the budget script runs in CI.
2. **Streaming re-renders, before panes** (P4, R3, P8). M. Should land before 3.1.
   *Done when:* while a mock reply streams on `/e2e/chat`, only the streaming message and the composer re-render
   per chunk (React DevTools profiler), and the closed picker does no catalog work.
3. **Retire the old Convex chat backend** (D1, `conversions.ts`, the Convex function-reference test from [CI guards](#ci-guards), roadmap
   6.1/6.3b wording). M. Needs Yash to OK deleting it, and later to check prod tables before they're dropped.
   *Done when:* every public Convex function is called by the app or allowlisted with a reason, and
   `generateUploadUrl` is gone.
4. **Lint and dead-code guards** (C1, the knip config and CI step, D2 except the composer buttons, D3, U3, C2's
   CLAUDE.md notes, G2's tests). S–M.
   *Done when:* Biome covers `convex/` and `vite.config.ts`, `bunx knip` passes in CI, and `@xyflow/react` and
   `shiki` are removed.
5. **Composer cleanup** (D2's dead buttons, R2, D4, U2, P6). M. Needs Yash's OK, since CLAUDE.md protects the
   composer. Best folded into 1.6 (attachments), which rewrites the upload code anyway.
6. **Provider registry and CSP enforcement** (U1, G1, G3). M. Do before adding providers. The CSP flip waits on
   Yash's log check.

## CI guards

### knip

Add `knip.json` and a CI step `bunx knip@6.44.0` (pinned, not in `package.json`, like this audit). Tested on this
snapshot: it reports only real findings (D2).

```json
{
	"$schema": "https://unpkg.com/knip@6/schema.json",
	"entry": ["scripts/*.ts", "src/routes/e2e/**/*.{ts,tsx}"],
	"ignore": [
		"src/routeTree.gen.ts",
		"src/models/parameter-probe.generated.ts",
		"src/components/ui/**",
		"src/components/animate-ui/**",
		"src/components/ai-elements/**"
	],
	"ignoreDependencies": ["glsl-noise", "web-vitals"],
	"ignoreExportsUsedInFile": true
}
```

- `scripts/*.ts` are CLI entry points (otherwise they're flagged as unused files).
- `src/components/ui`, `animate-ui` and `ai-elements` are vendored shadcn and AI Elements files that keep their
  full export lists on purpose.
- `glsl-noise` is used from a shader (`#pragma glslify`), which knip can't follow. `web-vitals` is waiting for 1.8;
  remove it from the list once 1.8 imports it.
- Today it reports the two unused files, `@xyflow/react` and `shiki`, and six unused exports. Fix those (slice 4)
  before making the step blocking.
- **What it can't see:** unused Convex functions, because every `convex/*.ts` is an entry point and the app
  reaches them through the `api` object. Add a Vitest test in slice 3 that lists every public
  query/mutation/action in `convex/_generated/api.d.ts`, greps `src/` and `e2e/` for `api.<module>.<name>`, and
  fails on any that isn't referenced or allowlisted with a reason.

### Bundle-size budget

Add `scripts/bundle-budget.ts`, run after `bun run build` in CI. It reads the route preloads from the Start
manifest (`.vercel/output/functions/__server.func/_tanstack-start-manifest_v-*.mjs`), gzips each file in
`.vercel/output/static/assets`, and fails above the budget. Numbers come from this build: start about 5% above
today's sizes so the step catches regressions, then tighten after slice 1.

| Measure (gzipped unless noted) | Today | Budget now | After slice 1 |
|---|---|---|---|
| Root preloads (every page) | 341 KB | 360 KB | 180 KB |
| `/login` (root + auth layout + page) | 384 KB | 405 KB | 230 KB |
| `/new` (root + dashboard + page) | 695 KB | 730 KB | 560 KB |
| `/settings` | 411 KB | 430 KB | 260 KB |
| Largest eagerly loaded chunk (minified) | 482 KB | 500 KB | 500 KB |
| Lazy `scene` chunk (minified) | 897 KB | 950 KB | 950 KB |
| CSS total | 20 KB | 24 KB | 24 KB |

The build also prints "Some chunks are larger than 500 kB". Keep `build.chunkSizeWarningLimit` at its default,
so the warning stays meaningful once `scene` is the only chunk over it.
