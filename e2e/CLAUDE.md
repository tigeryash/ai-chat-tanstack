# Playwright e2e

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.

- **Playwright** (`e2e/`, config `playwright.config.ts`) builds the app with `VITE_E2E=true` and runs it on :4174
  against `e2e/support/convex-stub.ts`, a local Convex and Better Auth where everyone is signed out unless a test
  calls `signInAs` (`e2e/support/accounts.ts`) for a Better Auth session (Convex stays signed out). No secrets needed.
- **Test pages** under `src/routes/e2e/` render components without a session (`/e2e/composer`). They exist in
  `bun run dev` and in `VITE_E2E` builds, and 404 in normal production builds. Add a page there when a test or a
  preview needs a component that normally sits behind sign-in.
- Import `test` and `expect` from `e2e/support/fixtures.ts`, not `@playwright/test`. Its automatic guards fail a
  test on any request that leaves the machine, any uncaught page error, or any CSP violation (report-only ones
  too). A test that provokes violations on purpose sets `test.use({ allowCspViolations: true })` and reads the
  `cspViolations` fixture. XSS payloads for model output live in `src/routes/e2e/-xss-payloads.ts`.
- **Screenshots**: baselines are per platform (`*-chromium-darwin.png` for local Macs, `*-chromium-linux.png` for
  CI). After an intentional visual change, refresh both: `bun run test:e2e --update-snapshots` and
  `bun run test:e2e:linux --update-snapshots`, then look at the new images before committing them.
