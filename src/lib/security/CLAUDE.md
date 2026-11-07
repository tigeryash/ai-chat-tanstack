# Security baseline

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.
- **Security baseline** (roadmap 1.0, `src/lib/security/`): `getRouter` makes a CSP nonce per request, the root
  route's `headers` sends the policy (strict one report-only for now), and `src/start.ts` adds the security headers
  and Start's server-function CSRF check to every response. A new provider is one entry in
  `src/models/provider-registry.ts` (its `apiOrigins` feed `provider-origins.ts`); any other third-party origin
  the browser calls goes in `csp.ts`, or the CSP reports it. `ENFORCE_STRICT_CSP` in `csp.ts` is the enforce switch.
- **Nitro's dev server 404s requests with `Sec-Fetch-Dest: report`** (it treats them as static assets). The
  `cspReportsInDev` plugin in `vite.config.ts` relabels CSP reports so they reach `/api/csp-report` in dev.
