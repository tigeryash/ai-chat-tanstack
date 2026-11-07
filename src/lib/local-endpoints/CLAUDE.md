# Local model endpoints

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.
- **Local models** (roadmap 2.3, `src/lib/local-endpoints/`): endpoints saved in Settings (localStorage, localhost
  and 127.0.0.1 only, to match `connect-src`); a local `ModelChoice` names its `endpoint` id. Nothing calls one
  before it's saved and the Local Network Access explainer was clicked through. e2e stubs a server with
  `context.route` (`e2e/local-models.spec.ts`); note `route.fulfill` adds a matching CORS header when you set none.
