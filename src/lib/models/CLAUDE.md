# Model catalog

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.
- **Models** (roadmap 2.1–2.2): Convex `models` table synced daily (`convex/modelCatalogSync.ts`, curation in
  `src/models/curation.ts`). The app reads `models.list` / `models.get` over HTTP (`src/lib/models/catalog.ts`), and
  the e2e Convex stub serves `src/lib/models/catalog.fixtures.ts`. Runnability per user is `runnability.ts`, the
  picker and model card are in `src/components/models/`, each chat's choice is `src/lib/chat/chat-model-choice.ts`.
