# Local chat storage

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.
- **Local chats** (roadmap 1.3, `src/lib/storage/`): a `ChatStore` interface over Dexie (IndexedDB database
  `highelo-chats`; the app's instance is `app-store.ts`). Every stored chat has a `formatVersion` (`format.ts` lists
  the migrations); export/import are versioned JSON in `export.ts`. Each chat has an `ownerId` (roadmap 1.9): the
  Better Auth user ID that made it, or null when made signed out. What a viewer may see is `ownership.ts`; the viewer
  comes from `src/lib/account.ts` (Better Auth's session, not Convex auth). Never list or open chats without it.
  **Dexie versions** (rules in `db.ts`'s header): prefer none (optional fields, or a new table); take the next
  number, and append chat format migrations, when you rebase, never earlier; `upgrade()` only in a version that
  changes nothing else; non-chat records get their own format number; `db.test.ts` pins the schema and wants an
  upgrade test per `upgrade()`. Worktrees share :3000's IndexedDB: on a `VersionError`, delete `highelo-chats`.
