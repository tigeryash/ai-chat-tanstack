# Model settings

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.
- **Model settings** (roadmap 2.4b, `src/lib/params/`): `registry.ts` defines each setting, `support.ts` decides
  which a model and host take (2.4a probe "accepted" first, then the catalog's lists from Convex `models.parameters`;
  unknown means hidden), `mapping.ts` turns them into `streamText` options and strips the rest. Each chat's
  settings sit on its ChatStore row (`lib/chat/chat-settings.ts`), the shared system prompt in the `prefs` table.
  The panel is `src/components/params/`. React Compiler trap: a hook called as a method (`store.use()`) or a read
  of a mutable Map can get memoized; wrap the first in a `use…` function, make the second an immutable snapshot.
