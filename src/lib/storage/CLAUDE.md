# Local chat storage

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.

- **Local chats** (roadmap 1.3, `src/lib/storage/`): a `ChatStore` interface over Dexie (IndexedDB database
  `highelo-chats`; the app's instance is `app-store.ts`). Every stored chat has a `formatVersion` (`format.ts` lists
  the migrations); export/import are versioned JSON in `export.ts`, offered in Settings → Your data (roadmap 1.10,
  `data-transfer.ts`, loaded with `import()`; wording and the size cap in `data-file.ts`). Export format 2 adds
  workspaces and saved layouts (`src/lib/workspaces/workspace-transfer.ts`); the newer-copy rule is `newer-copy.ts`. Each chat has an `ownerId` (roadmap 1.9): the
  Better Auth user ID that made it, or null when made signed out. What a viewer may see is `ownership.ts`; the viewer
  comes from `src/lib/account.ts` (Better Auth's session, not Convex auth). Never list or open chats without it.
  **Dexie versions** (rules in `db.ts`'s header): prefer none (optional fields, or a new table); take the next
  number, and append chat format migrations, when you rebase, never earlier; `upgrade()` only in a version that
  changes nothing else; non-chat records get their own format number; `db.test.ts` pins the schema and wants an
  upgrade test per `upgrade()`. Worktrees share :3000's IndexedDB: on a `VersionError`, delete `highelo-chats`.
- **Branches** (roadmap 1.7, `branches.ts`): `Chat.messages` is only the path shown; other versions of edited
  messages and regenerated replies (R4, `regenerateAt`), with what followed them, are `Chat.branches` (forks plus off-path messages), stored in the `branches` table and
  absent when a chat has none. `saveMessages` without `branches` keeps the stored ones, so code that never loaded
  them can't wipe them. Open chats keep theirs in `src/lib/chat/chat-branches.ts`.
- **Votes** (roadmap 3.4, `votes.ts`): thumbs up/down by reply message id on the chat row (`votes`), optional and
  cleaned on read like `settings`; `saveMessages` keeps them. Open chats keep theirs in `src/lib/chat/chat-votes.ts`.
- **Prompts** (roadmap 3.6a): the `prompts` table (Dexie version 6) belongs to `src/lib/prompts/`, with its own
  format number; read it through `prompt-store.ts`, not this folder's ChatStore.
- **Attachments** (roadmap 1.6, `attachments.ts`): in the app a file part's `url` is a data URL; in IndexedDB the
  bytes sit in the `attachments` table (Dexie version 7) and the stored part says
  `attachment:<chatId>/<messageId>/<index>`. `writeChat` swaps them out and deletes files nothing points to;
  `getChat` swaps them back (a missing one is dropped), so exports carry the files. `deleteChat` deletes them, so
  anything that removes chats through the ChatStore (sign-out removal included) removes their files. Never log or
  `track()` their contents. Text and code files (1.6b) are stored the same way; only the transport turns them into
  text parts (`src/lib/attachments/text-file.ts`).
