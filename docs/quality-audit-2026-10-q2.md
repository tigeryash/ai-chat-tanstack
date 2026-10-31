# Quality audit Q2, October 2026

Snapshot of `main` at `a2457d8` (2026-10-31, after PR #58), the end of Milestone 1. Read-only: no app code
changed. It covers what landed since Q1's snapshot `4313b66`: 1.8 analytics (#44), 7.1 legal pages (#43), 3.0b
tokens (#45), 2.4b model settings (#47), Q1's fix slices (#48–#53), 3.11 appearance (#55), 3.1/3.2 workspaces
(#56) and the composer restore (#57). Format and severity scale follow [Q1](./quality-audit-2026-10.md). Track the
work in [ROADMAP.md](./ROADMAP.md).

## Summary

Q1's fixes held. The first load is still lean (root 193 KB gzipped, no chat packages before a chat), the hard
rules hold in the new code, CI is green and steady (no flaky e2e in the last 15 runs), and knip is clean. 3.1/3.2
and 3.11 were built side by side but don't conflict. The problems sit in workspaces:

1. **A workspace pane can lose its chat history (W1, high, reproduced).** The workspace route caches its loader
   forever (`staleTime: Infinity`). After the person opens 9 other chats, the pane chats are released (Q1's P8
   LRU), and returning to the workspace from the sidebar reopens each pane as an *empty* chat under the saved id.
   The next reply in that pane saves only the new messages, and the store's full rewrite deletes the old history.
2. **Workspaces only half-follow the 1.9 ownership filter (W2–W4).** Panes from another account are hidden on
   open, but then dropped from the record on the next save. Deleting a workspace from the sidebar deletes every
   pane's chat, including hidden ones from another account. New panes take the *workspace's* owner, so a chat made
   signed in can be saved as no-account.
3. **Milestone 2 will add Dexie versions in parallel (M1).** 1.7, 2.5 and 3.6 each likely add one. Dexie 4 doesn't
   run an `upgrade()` it skips, so two branches that both write `version(5)` can silently skip a migration. A
   short convention and one schema test prevent it.
4. **`bun run verify` fails in every worktree (C1).** It doesn't just skip Biome, as `CLAUDE.md` says: it exits 1
   with "No files were processed". Agents work around it each session.

Recommended order: slice 1 (pane history) now, then slice 2 (ownership) and slice 3 (Dexie convention) before
Milestone 2 starts. See [Proposed slices](#proposed-slices).

Tools run: `bun run typecheck` and `bun run test` (78 files, 658 tests, 5.2 s, all pass), Biome from a clone
outside `.claude/` (434 files, clean), `bunx knip@6.44.0` (clean), `bun run build --sourcemap` then
`bun scripts/bundle-budget.ts --sourcemap` (all pass), `npx react-doctor` (49/100, 89 issues; Q1 was 47/100 and
103), a throwaway Playwright spec to reproduce W1 (not committed), a micro-benchmark of the pane-sync hub, and a
manual pass over the diff since Q1.

## Findings

Severity: **high** = fix soon (data loss, security, or a cost on every page), **medium** = fix before the feature
that leans on it, **low** = tidy-up. Fix size: S (under an hour), M (one session), L (more than one session).

### Workspaces and ownership (3.1/3.2 with 1.9)

**W1 (high) Returning to a workspace can reopen a pane empty, and its next reply erases the saved history.** M.
- Files: `src/routes/(dashboard)/w/$workspaceId.tsx` (`staleTime: Number.POSITIVE_INFINITY`),
  `src/components/workspaces/workspace-view.tsx` (`renderPane` calls `openChat(pane.chatId)` with no messages),
  `src/lib/chat/open-chats.ts` (`releaseIdleChats`), `src/lib/storage/dexie-chat-store.ts` (`writeChat` deletes
  every message, then writes the new list).
- Why: pane chats are only retained while the workspace is on screen. Open 9 other chats (hover preloads from the
  sidebar open chats too, so probably those count; not tested), and they're released. Back on the workspace, the cached loader data skips `openWorkspace`, so
  `openChat(id)` makes a new, empty `Chat` with that id. Reproduced: send in a 2-pane workspace, visit 9 chats via
  "New chat", click the workspace in the sidebar: pane 1 is empty. Send again, reload: the first message is gone.
  With 1 other chat instead of 9, it's fine.
- The same pattern sits in `$chatId.tsx` (`openChat(chatId)` in render). Its loader re-runs on navigation, so
  it's only exposed when a hover preload (fresh for 30 s) is followed by 9 more opened chats before the click.
- Fix: (a) never create a chat in render: render reads `peekOpenChat(id)` and, when it's missing, reopens it
  from the store (`openSavedChat`) behind a short loading state; (b) drop the infinite `staleTime` and let
  `openWorkspace` re-run (it already reuses open chats), keeping the view's own copy of the pane list;
  (c) optionally, `saveMessages` refuses to replace a stored chat with a list that doesn't start with its stored
  first message (regenerate and edit keep the start). Add the repro as an e2e test. The throwaway spec is in the
  coordinator's notes folder (`q2-workspace-data-loss-repro.spec.ts`).

**W2 (medium) Opening a workspace hides another account's panes, then the next save drops them.** S.
- Files: `src/lib/workspaces/workspace-sessions.ts` (`openWorkspace` filters panes),
  `src/components/workspaces/workspace-view.tsx` (`save` writes the filtered list).
- Why: a resize, sync toggle or move rewrites the record without the hidden panes. The other account's chats
  then fall out of the workspace and show up as loose chats in its sidebar. Nobody loses messages, but the layout
  is lost, and the 1.9 filter changes data instead of only hiding it.
- Fix: `openWorkspace` returns the shown panes plus the hidden ones. `save` writes the hidden ones back in their
  original place, and the hidden panes' widths are kept out of the layout.

**W3 (medium) Deleting a workspace from the sidebar deletes chats the viewer can't see.** S.
- Files: `src/lib/workspaces/sidebar-entries.ts` (`chatIds` and `paneCount` come from the whole record),
  `src/components/sidebar/app-sidebar.tsx` (`remove` calls `deleteChats(entry.workspace.chatIds)`),
  `src/components/sidebar/chat-list-item.tsx` (the dialog's pane count).
- How it happens: signed out, make a workspace and reply in both panes. Sign in and choose "add" (the chats move
  to the account; the workspace stays no-account). Add a pane and reply (W4 saves that chat as no-account). Sign
  out: the workspace is listed through its no-account pane, and Delete removes the account's two chats as well.
  A chat in two workspaces is deleted with the newer one, even though the older one still lists it.
- Fix: `sidebarEntries` carries only the viewer's visible chat ids and counts. Deleting a workspace deletes those
  chats and drops the record only when no hidden pane remains. Otherwise it removes the visible panes.

**W4 (medium) New panes take the workspace's owner, not the viewer.** S.
- Files: `src/lib/workspaces/workspace-sessions.ts` (`addNewPane` and `openPaneChat` use `workspace.ownerId`),
  `src/routes/(dashboard)/$chatId.tsx` (`AddPaneButton`'s `ownerId` prefers the chat's owner).
- Why: signed in, adding a pane to a no-account workspace (or "Add pane" on a no-account chat) makes a chat that
  saves as no-account. 1.9 says a chat made signed in belongs to the account. It also makes W3 reachable.
- Fix: new pane chats take the current viewer as owner. Decide (Yash, small) whether the "add these chats to my
  account" answer also moves no-account workspaces; `answerNoAccountPrompt` and `removeAccountChats` in
  `src/lib/chat/chat-ownership.ts` ignore workspaces today, so "remove" leaves records pointing at deleted chats
  (they reopen as empty panes).

**W5 (low) On a phone, every pane mounts twice.** S.
- File: `src/hooks/use-mobile.ts` (starts `false`, then sets the real value in an effect).
- Why: the workspace first renders the desktop row of panes, then remounts each pane in the mobile tabs, so every
  pane's `ChatScreen` and hub join run twice. React Doctor flags the same hook (`set-state-in-effect`).
- Fix: read `matchMedia` in a `useSyncExternalStore` (its first value is right on the client; these routes don't
  render on the server).

### Four panes streaming at once

Per chunk, only the streaming pane renders: each `ChatView` has its own `useChat` with `throttle: 50`, the
workspace view subscribes to nothing per chunk, and the synced composer re-renders only when the hub's `draft`,
`replying` or `diverged` changes. Four panes at once render at most about 80 times a second in total, each
render limited to its own pane. What's left:

**S1 (low) The sync hub recomputes divergence on every chunk, unthrottled.** S.
- File: `src/lib/workspaces/pane-sync.ts` (`join` registers `~registerMessagesCallback(recompute)` with no
  throttle; `recompute` rebuilds every synced pane's user history).
- Measured: 0.1 ms per call with 4 panes of 200 messages (100 user messages of 2 KB each). With four panes
  streaming at roughly 50 chunks a second each, that's about 2% of a core. Fine today. 1.6 attachments and longer
  chats raise it.
- Fix: pass a throttle to `~registerMessagesCallback`, or recompute `diverged` only on status changes (user
  messages only change when a send starts).

**S2 (low) The 8-chat limit doesn't know about panes.** S, fold into W1.
- `MAX_IDLE_OPEN_CHATS = 8` counts every open chat. Two 4-pane workspaces fill it, so visiting one releases the
  other. That's the intended trade-off, but it's what makes W1 easy to hit. Once W1 reopens released chats from
  the store, it only costs a read.

**S3 (low) A synced send fires one `chat_sent` per pane.** S, decide only.
- File: `src/components/chat/chat-view.tsx`. Each pane's `send` calls `track`, so one send from four synced panes
  is four events, each with `paneCount: 4`. Either is defensible; say which in `docs/data-inventory.md` so the
  dashboard isn't misread.

### Storage and Dexie versions (before Milestone 2)

**M1 (medium) Parallel slices will collide on Dexie versions and format migrations.** S.
- Files: `src/lib/storage/db.ts` (versions 1–4), `src/lib/storage/format.ts` (`MIGRATIONS`),
  `src/lib/storage/workspace.ts` (`WORKSPACE_FORMAT_VERSION`).
- Why: 1.7 (edit and branch), 2.5 (usage and cost) and 3.6 (prompt library) will each probably add a table or
  index, and 1.7 a message-format migration. Two branches that both add `version(5)` conflict in text, which is
  easy to resolve wrongly. Dexie 4.4 adds missing tables by itself when the declared schema grows without a version
  bump, but it never runs an `upgrade()` for a version the browser has already passed. So an upgrade that lands
  out of order is silently skipped. Every worktree's dev server also shares `localhost:3000`'s IndexedDB: a branch
  at `version(5)` leaves the database there, and `main` then fails to open it with a `VersionError` until it's
  deleted.
- Convention (put it in `db.ts`'s header and `CLAUDE.md`):
  1. **Prefer no version.** New fields go on existing rows as optional, cleaned-on-read values (as 2.4b's
     `settings` did). New data that needs a query goes in a **new table** rather than a new index on `chats`.
  2. **Take the next number when you rebase, not when you start.** Never reserve one. A slice that finds `main`
     moved re-numbers its block to the end.
  3. **An `upgrade()` only in a version that adds nothing else**, and only for data that must change in place.
     Never edit a shipped version block.
  4. **Chat format migrations** (`MIGRATIONS`) follow the same rule: append at rebase time; only 1.7 should need
     one in Milestone 2. Workspaces and future records (prompts, usage) get their own format number, as
     `workspace.ts` does, so they never bump the chat format.
  5. **Guard test** `src/lib/storage/db.test.ts`: the list of declared versions is strictly increasing, the
     latest schema equals a pinned snapshot (tables and indexes), and every version with an `upgrade()` has a
     test that opens a database at the previous version. A bad rebase then fails in CI instead of in a browser.
  6. **Dev databases:** note in `CLAUDE.md` that switching branches on `localhost:3000` can leave a newer
     `highelo-chats`; delete it in DevTools (Application → IndexedDB).

**M2 (low, Q1's P7, still open) Every reply rewrites the whole chat.** M, fold into 1.7.
- `writeChat` deletes and re-puts every message on each save. It's what turns W1 into data loss. 1.7 changes how
  messages are stored (branches), so it should write only what changed and set the title in the same transaction.

### First load and the bundle budget

| Route (gzipped JS it preloads) | Q1 fix (#50) | Now | Budget |
|---|---|---|---|
| Root (every page) | 189 KB | 193.4 KB | 195 KB |
| `/login` | 229 KB | 234.3 KB | 240 KB |
| `/new` | 557 KB | 537.6 KB | 580 KB |
| `/settings` | 340 KB | 357.1 KB | 370 KB |
| `/w/$workspaceId` | (new) | 554.6 KB | none |
| Largest preloaded chunk (min) | 370 KB | 376.9 KB (entry) | 400 KB |
| CSS | 23 KB | 20.8 KB | 24 KB |

No chat-only package (`@ai-sdk/*`, `ai`, `dexie`, `gsap`, `streamdown`) is in the root or `/login` preloads.
3.11 stays off the first load: the boot script is inlined text, `<AppearanceSync />` imports the settings code
lazily, and the fonts are self-hosted `@font-face` rules that download only when a token names them.
`react-resizable-panels` (16 KB gzipped) loads only with the workspace route.

**B1 (low) The root budget has 1.6 KB of headroom, and the workspace route has no budget.** S.
- File: `scripts/bundle-budget.ts`. Root is 115 KB of entry (react-dom, Convex, query-core), zod 28 KB, router
  21 KB, Better Auth client 11 KB; nothing chat-related. The first Milestone 2 slice that adds anything to
  `__root.tsx` will fail the step, and the easy reaction is to raise the number.
- Fix: add `/w/$workspaceId` (budget 580 KB). Write in the script's header what may grow the root (only
  `__root.tsx` itself, reviewed) and that raising a budget needs a line in the PR explaining what grew.

**B2 (low, needs Yash's approval) The composer imports Motion in full again.** —
- `src/components/chat/input*`, `src/components/animate-ui/` (restored in #57). The composer chunk is 55 KB
  gzipped, three quarters `motion-dom`. #51's `LazyMotion` change was reverted with the rest of the composer.
  Switching back to `LazyMotion` + `m` doesn't change how anything looks, but it touches the animate-ui icons, so
  it needs a check against the composer baselines and Yash's OK. Not urgent: it's only on chat routes.

### Hard rules in the new code

Checked by hand across the diff:
- **Keys (rule 1):** read only in `browser-transport.ts` (passed to `language-model.ts`) and the key test row.
  Nothing in analytics, appearance or workspaces touches them. One nit: `provider-key-row.tsx` imports
  `getProviderKey` from `@/lib/keys/vault` instead of `@/lib/keys` (H1 below).
- **Model output (rule 5):** `<Streamdown>` appears only in `hardened-streamdown.tsx`, which only
  `safe-markdown.tsx` loads. No `dangerouslySetInnerHTML` anywhere.
- **Reduced motion (rule 3):** pane add/reorder use `INSTANT` under reduced motion and are covered by
  `e2e/reduced-motion.spec.ts`. The theme cross-fade checks `matchMedia(REDUCED_MOTION)` before
  `startViewTransition`. The restored animate-ui icons have their own reduced-motion check. Three ways to do it
  (root `MotionConfig`, a manual `INSTANT`, `matchMedia`), all correct. No new loop animations.
- **Analytics (rule 4):** four `track()` calls, all allowlisted closed-set properties, no content.
- **CSP:** no new origins since Q1. Fonts are bundled. Imported theme files are validated (hex colors only), and
  the boot script only sets `--` custom properties.
- **Composer (rule 8):** #57 restored the original design. See C3 and B2 for what's left there.

**H1 (low) One key read bypasses the `@/lib/keys` entry point.** S.
- `src/components/settings/provider-key-row.tsx:9-13`. Change the import, and add a Biome
  `noRestrictedImports` rule for `@/lib/keys/vault` outside `src/lib/keys/`, like the Zod one.

### 3.1/3.2 against 3.11

No duplication or conflicting patterns. Appearance only overrides tokens on `<html>`, and panes use token classes
(`rounded-pane border bg-card`), so a custom theme reaches every pane. Appearance settings live in localStorage
through `createLocalStore`, and workspaces in Dexie through the `ChatStore`: each where `CLAUDE.md` says. The
merge (`9a491cd`) touched only shared lists (`CLAUDE.md`, roadmap, `reduced-motion.spec.ts`, `bun.lock`). The one
shared concern is the screenshot baseline below (T3).

### Q1 findings still open

#48–#53 did what Q1's slices asked, with these exceptions:
- **P3 (raw HTML in replies):** still parsed then sanitized. A product call, asked in #50 and not answered.
- **P7:** still open, see M2.
- **D2 and D4 (composer buttons and the animate-ui icons):** fixed in #51, then deliberately restored in #57.
  Closed as Yash's design. The four restored buttons still have no accessible name (C3).
- **R1 (compiler bail-outs on `try`/`finally`):** still in `auth-form.tsx`, `provider-key-row.tsx` and
  `sign-out-item.tsx`; `appearance-sync.tsx` is new on the list. Low; re-check after the next compiler release.
- **G1 (CSP enforce):** the switch exists (#52) and is off, waiting on the owner to-do (Vercel `[csp]` logs).
- Old Convex tables: dropping them waits on Yash's prod row check (owner to-do).

### Accessibility

**C3 (low, invisible fix) Four composer buttons have no accessible name again.** S.
- Files: `src/components/chat/input/web-search-button.tsx:13`, `deep-research-button.tsx:7`,
  `voice-input-button.tsx:7`, `voice-chat-button.tsx`. Their tooltips aren't names, so screen readers announce
  "button" (Q1's R2). #51 removed these buttons instead of naming them, and #57 brought them back as they were.
  An `aria-label` doesn't change how they look, so hard rule 8 allows it. The composer baselines must stay
  unchanged.

### CLAUDE.md accuracy

It's 253 lines (3,200 words), read every session.

**C1 (medium) `bun run verify` fails in worktrees, and the gotcha undersells it.** S.
- `biome.json` force-ignores `!!**/.claude`, which matches the worktree's own path. `bun run check` then exits 1
  ("No files were processed"), so `verify` fails before Vitest runs. `CLAUDE.md` says it "checks nothing" and
  tells agents to clone to `/tmp`. Every slice runs in a worktree.
- Fix: make the ignore root-relative (`!!.claude/**`; check that Biome resolves it against the config folder), or
  pass `--no-errors-on-unmatched` plus a CI-style clone check. Then cut the 5-line gotcha.

**C2 (low) Small corrections and cuts.** S.
- Stale: "Older names (`components/chat/chatstuff/`, `src/utilities/`, `src/types/`)": `src/utilities/` is
  gone. "Motion for the composer": workspaces use it too.
- Missing: the Dexie convention (M1); "never `openChat(id)` in render for a saved chat" (W1); "every list or
  delete of workspace chats goes through the viewer's visible ids" (W3).
- Cut or shorten (about 25 lines): the knip bullet in Conventions repeats the Commands table; the Playwright
  shard sentence belongs in `ci.yml`; the `convex` 1.46 and Vercel `node_modules` gotchas can each be one line
  with a link to the PR that fixed them; the "Background status" and "Appearance" paragraphs can drop the
  implementation detail that their file headers already give.

### Test health

- **Vitest:** 78 files, 658 tests, 5.2 s. New modules without a test file: `src/lib/workspaces/workspace-sessions.ts`
  (the ownership filter, where W2–W4 live), `src/lib/chat/open-chats.ts` (LRU and retain; only touched from
  `chat-sessions.test.ts`), `src/lib/storage/workspace.ts` (covered through `workspace-store.test.ts`), and
  `src/lib/params/registry.ts`, `routes.ts`, `src/lib/appearance/store.ts` (simple, low risk).
- **Playwright:** 189 tests in 4 shards of about 2 minutes each, balanced. No failures or flaky retries in the last
  15 CI runs since #53. `retries: 1` in CI would hide a flaky test, so look for "flaky" in the summary now and
  then.
- **Missing e2e:** workspaces with ownership (no-account workspace, sign in, add, sign out) and returning to a
  workspace after other chats (W1).

**T3 (low) The workspace screenshot contains three composers.** S.
- `e2e/workspaces.spec.ts:282` (`workspace-three-panes.png`). Any approved composer change has to refresh it, and
  any workspace change refreshes an image with the composer in it, which hard rule 8 says needs Yash. Mask the
  composers (`mask: [page.locator(".composer-design")]`) so `composer-design.spec.ts` stays the only composer
  baseline.

## Proposed slices

Each slice lists the files it touches. Slices that share no files can run in parallel.

1. **Pane history safety** (W1, S2, part of M2's guard). M. **Before Milestone 2, start first.**
   Files: `src/routes/(dashboard)/w/$workspaceId.tsx`, `src/routes/(dashboard)/$chatId.tsx`,
   `src/components/workspaces/workspace-view.tsx`, `src/lib/chat/chat-sessions.ts`, `src/lib/chat/open-chats.ts`
   (+ new `open-chats.test.ts`), optionally `src/lib/storage/dexie-chat-store.ts`, `e2e/workspaces.spec.ts`.
   *Done when:* the repro (2-pane workspace, 9 other chats, back via the sidebar) shows the history and keeps it
   after a reply and a reload, as an e2e test; no route creates a chat in render.
2. **Workspace ownership** (W2, W3, W4, plus the ownership e2e). M. **Before Milestone 2, after slice 1** (both
   touch `workspace-view.tsx`). Needs Yash's one-line answer on W4 (do no-account workspaces move with "add").
   Files: `src/lib/workspaces/workspace-sessions.ts` (+ new test), `src/lib/workspaces/sidebar-entries.ts`,
   `src/components/sidebar/app-sidebar.tsx`, `src/components/sidebar/chat-list-item.tsx`,
   `src/components/workspaces/workspace-view.tsx`, `src/components/workspaces/add-pane-button.tsx`,
   `src/lib/chat/chat-ownership.ts`, `e2e/chat-ownership.spec.ts`.
   *Done when:* a workspace never deletes, drops or re-owns a chat the viewer can't see, new panes belong to the
   viewer, and the scenario in W3 is an e2e test.
3. **Dexie and format convention** (M1). S. **Before 1.7, 2.5 and 3.6 start.** Parallel with 1 and 2.
   Files: `src/lib/storage/db.ts` (header comment only), new `src/lib/storage/db.test.ts`, `CLAUDE.md`
   (Local chats paragraph).
   *Done when:* the guard test pins today's schema, and the convention is in `db.ts` and `CLAUDE.md`.
4. **Worktree verify and CLAUDE.md trim** (C1, C2, H1). S. **Before Milestone 2** (every slice runs `verify`).
   Parallel with 1 and 2; after 3 if both edit `CLAUDE.md` at once (or fold 3's lines in here).
   Files: `biome.json`, `CLAUDE.md`, `src/components/settings/provider-key-row.tsx`.
   *Done when:* `bun run verify` passes inside a `.claude/worktrees/` checkout and still checks every file
   CI checks, and `CLAUDE.md` is about 25 lines shorter.
5. **Small follow-ups** (W5, S1, S3, B1, T3, C3). S. Any time, parallel with everything above except slice 2
   (none of these files overlap it).
   Files: `src/hooks/use-mobile.ts`, `src/lib/workspaces/pane-sync.ts`, `docs/data-inventory.md`,
   `scripts/bundle-budget.ts`, `e2e/workspaces.spec.ts` (screenshot mask; after slice 1, which edits it too),
   `src/components/chat/input/{web-search,deep-research,voice-input,voice-chat}-button.tsx` (aria-labels only;
   composer baselines must not change).
   *Done when:* the budget covers `/w`, the composer buttons have names, and the workspace screenshot masks the
   composers.

Folded into Milestone 2, not separate slices: M2 (incremental saves) goes with 1.7. B2 (`LazyMotion` in the
composer) waits for Yash. R1 waits for a compiler release.

## CI guards

- **Dexie schema test** (slice 3): described in M1. It runs in Vitest, so no CI change.
- **`noRestrictedImports` for `@/lib/keys/vault`** (H1): only `src/lib/keys/` may import the vault directly.
- **Bundle budget:** add the `/w/$workspaceId` route (B1).
- **Worktree Biome** (C1): once fixed, the pre-commit hook and `verify` agree with CI in every checkout.
- Already in place and holding: knip, `publicFunctions.test.ts`, the chat-only package check in the budget, the
  design-token and appearance-token drift tests, and the composer baselines.
