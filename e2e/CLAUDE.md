# Playwright e2e

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.

- **Playwright** (`e2e/`, config `playwright.config.ts`) builds the app with `VITE_E2E=true` and runs it on :4174
  (or `E2E_PORT`, with the stub on the next port; a running server is reused only with `E2E_REUSE_SERVER=1`)
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
- **Linux baselines on a Mac** (Docker, x86 emulated): pass spec files *before* flags, run only the screenshot
  specs, one worker: `sh e2e/run-in-docker.sh e2e/workspaces.spec.ts e2e/composer-design.spec.ts --workers=1
  --update-snapshots=changed` (`-u` takes a mode, so a spec after it is an error). The full suite times out under
  emulation; CI on real Linux runs it. A `SIGABRT` from the build is emulation too: rerun. If Docker Desktop
  won't start, it's usually waiting for an admin password for privileged port mapping (turn that off in
  Settings → Advanced; the tests don't need it). Hide run-to-run values (usage stats) in screenshots with
  `[data-usage] { display: none }`, as the workspace screenshots do.
