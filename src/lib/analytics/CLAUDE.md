# Analytics

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.

- **Analytics** (roadmap 1.8, `src/lib/analytics/`): `track()` is the only way to send an event; add new ones to
  the allowlist in `events.ts` (closed-set properties only) and to `docs/data-inventory.md`. Vercel Web Analytics
  and Speed Insights load from `<VercelAnalytics />` in `__root.tsx` in production builds only; dev and e2e record
  events in `window.__highEloAnalytics`. Settings → Analytics (and GPC / Do Not Track) turns everything off.
- The same switch (`analyticsAllowed()`) gates Sentry error reports (roadmap 1.8b, `src/lib/error-reporting/`).
