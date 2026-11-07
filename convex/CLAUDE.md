# Convex backend

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.

- **Convex** (`convex/`) is the backend: `schema.ts` (the old chat tables are unused, kept until prod rows are
  checked), `users` row upsert in `authHelpers.ts`, `_generated/` is generated. Query keys go through
  `@convex-dev/react-query`. `convex/publicFunctions.test.ts` fails on any public function the app never calls as
  `api.<module>.<name>`; delete it or allowlist it there with a reason.
- **Convex function tests** use `convex-test` through `convex/test.helpers.ts`: `createConvexTest()` registers the
  Better Auth component, and `signIn(t, name)` seeds a Better Auth user and session and returns a client acting as
  them. Files with two dots (`*.test.ts`, `test.helpers.ts`) are never deployed by Convex.
- **Keep `convex` at 1.46 or newer**; older CLIs need data access the deploy key doesn't have (#5).
