# Error reporting

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.

- **Sentry** (roadmap 1.8b): `<ErrorReporting />` in `__root.tsx` calls `startErrorReporting`, which imports
  `sentry.ts` (and `@sentry/browser`) only when `VITE_SENTRY_DSN` is set and `analyticsAllowed()`. Never import
  `@sentry/*` statically anywhere else: `scripts/bundle-budget.ts` fails if it reaches a root or /login preload.
- **`scrub.ts` is an allowlist.** `scrubEvent` copies only named fields; to send a new one, add it there with a test
  in `scrub.test.ts` that feeds it a fake key, prompt and file name. Never add Session Replay, tracing, or the
  console/dom/fetch/xhr breadcrumbs.
- Errors the router catches reach Sentry through `reportError` (`route-error.tsx`). Never build an error message
  from a prompt, reply, file or file name: only quoted text and key-shaped strings are removed from messages.
