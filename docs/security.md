# Security

Threat model and rules for this app. Agents working on any slice that touches keys, rendering, tools, local
endpoints, or Convex writes must follow this file. References: OWASP Top 10 for LLM Applications (2026),
OWASP Top 10 for Agentic Applications (Dec 2025), "Design Patterns for Securing LLM Agents against Prompt
Injections" (arXiv 2506.08837), Google DeepMind's CaMeL (arXiv 2503.18813), and Meta's "Agents Rule of Two".

## What we're protecting, ranked

1. **Users' API keys.** They live in the browser (roadmap decision 2), so any script running in our page can read
   them. The main threats are XSS (including XSS through model output) and a compromised npm dependency.
2. **Users' chats.** Private content stored locally, and in Convex when synced or shared.
3. **Users' machines.** Local model servers we ask them to expose to the browser.
4. **Our backend.** Convex writes (sync, shares, invites) can be spammed. There's no inference spend to abuse.

## Baseline (roadmap 1.0, ships before the key UI)

**Content Security Policy.** Ship a strict CSP from the server:
- `script-src 'nonce-…' 'strict-dynamic'`: no inline scripts without the nonce, and no `unsafe-eval`.
- `connect-src` lists exactly the provider API origins we support, the Convex URL, the analytics/Sentry endpoints,
  and `http://localhost:*` / `http://127.0.0.1:*` for local models. A script injected by XSS then can't send a key
  to an attacker's server.
- `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, and `frame-src` limited to the artifacts sandbox origin.
- Roll it out with `Content-Security-Policy-Report-Only` first, then enforce. Consider Trusted Types
  (`require-trusted-types-for 'script'`) once the codebase is clean, since it blocks DOM XSS sinks in Chromium.

*Where it stands (1.0, 2026-10-25).* The policy is built in `src/lib/security/csp.ts`; the provider list is
`src/lib/security/provider-origins.ts`, built from each entry's `apiOrigins` in the provider registry
(`src/models/provider-registry.ts`, quality audit U1) and pinned by `provider-origins.test.ts`. `getRouter` makes a nonce per server render (`ssr.nonce`; Start puts it on
every script it emits) and the root route's `headers` sends two policies:
- **Enforced:** `object-src 'none'; base-uri 'none'; frame-ancestors 'none'`. These break nothing, so they didn't
  wait. (`frame-ancestors` is ignored in report-only policies, so this is what actually stops framing, with
  `X-Frame-Options: DENY` for older browsers.)
- **Report-only:** the full strict policy. `style-src` allows `'unsafe-inline'` because React, Motion and GSAP set
  `style` attributes, which nonces can't cover. `img-src` is `'self' data: blob:`, so no remote images at all.
- Reports go to `report-uri /api/csp-report`, which logs one `[csp]` line per violation (directive, blocked
  origin, page path; no query strings or script samples). No `report-to`: when it's present Chrome ignores
  `report-uri` and queues reports in the Reporting API, which never delivered in testing.
- Every Playwright test fails on any CSP violation, report-only ones included (`e2e/support/fixtures.ts`), so the
  report stays clean in normal use.
- **To enforce:** set `ENFORCE_STRICT_CSP = true` in `csp.ts` (quality audit G1, off as of 2026-10-30). It sends
  the strict policy as `Content-Security-Policy` and keeps a report-only copy (new directives get trialled there
  first; until then each violation is reported twice, once per `disposition`). Flip it once Vercel's logs show no
  `[csp]` lines after a week of real use, signed-in chat included (Owner to-do in the roadmap). The Playwright
  project `csp-enforced` already runs the chat, key, local-model and XSS specs with the strict policy enforced
  (in `VITE_E2E` builds an e2e-only cookie makes `src/start.ts` enforce it; `e2e/csp-enforced.spec.ts` checks it
  blocks), so the flip needs no test changes.
- Things the policy needed: Zod 4 compiles schemas with `new Function`, so `src/lib/zod.ts` (the only allowed Zod import) turns that off
  before any schema runs. The composer's image compression ran in a worker that loaded its library from
  `cdn.jsdelivr.net`; it now runs on the page (`useWebWorker: false`).

**Security headers.** `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `Permissions-Policy` (microphone allowed for self only, camera and geolocation
denied), and `Cross-Origin-Opener-Policy: same-origin`. They live in `src/lib/security/headers.ts`: a request
middleware in `src/start.ts` adds them to everything our server answers, and `vite.config.ts` writes the same
values into Vercel's routing config for static files.

**Rendering model output.** Treat every model reply as attacker-controlled (a web page or file the model read may
have put words in its mouth).
- Never render model output as raw HTML. Markdown goes through Streamdown's hardening with an allowlist of link
  and image URL prefixes. Test reference-style links (`[x][1]`) too, which bypassed a filter in the EchoLeak attack.
- Don't auto-load remote images from model output. Show a "load image from example.com" placeholder instead,
  because an image URL can carry chat data to an attacker in its query string.
- Links open with `rel="noopener noreferrer"` and show the real domain on hover.
- All model output renders through `SafeMarkdown` (`src/components/ai-elements/safe-markdown.tsx`): raw HTML is
  sanitized with GitHub's schema, then links must start with `https://`, `http://` or `mailto:`, and an `https://`
  image becomes an "Image from host (opens in a new tab)" link (`src/lib/security/markdown-urls.ts`). Never render
  model output with plain `<Streamdown>`, or with `hardened-streamdown.tsx` (SafeMarkdown's lazy-loaded half,
  which lacks the safe link and image components).
- Huge or deeply nested replies can hang or overflow the parser (2,000 nested `>` overflows the stack; 40,000
  unmatched `*_` take 4.5 s). Past the limits in `src/lib/security/markdown-limits.ts` a reply renders as plain
  text, and an error boundary does the same for anything else that throws.
- Artifacts and HTML previews render in an iframe on a **separate origin** (e.g. `sandbox.<domain>`) with
  `sandbox="allow-scripts"` and never `allow-same-origin`. That's how Claude, ChatGPT, and GitHub isolate user content.

**Dependency hygiene.** A compromised package runs inside our page and can read keys, so:
- Commit `bun.lock`, and use `bun install --frozen-lockfile` in CI.
- Set a minimum release age (Bun supports `--minimum-release-age`; put it in `bunfig.toml`) so brand-new versions,
  where most npm worm payloads live, aren't installed for a few days.
- Bun never runs dependency lifecycle scripts unless they're in `trustedDependencies`. Keep that list empty unless
  there's a reason.
- Automated update PRs (Renovate/Dependabot), grouped and reviewed. Prefer fewer dependencies.

**Scrubbing.** One `redact()` utility used by `track()`, the Sentry `beforeSend`, and any logging. It drops anything
key-shaped (`sk-…`, `sk-ant-…`, `AIza…`, `xai-…`, bearer headers) plus every key the vault holds (1.1), and
analytics never receive prompt or reply text at all.
It is `src/lib/redact.ts`; app code logs through `logError`/`logWarn` in `src/lib/log.ts`, which run it first.
`convex/` has its own logging (names and config only) and doesn't import it yet.

**Dependencies (1.0).** `bunfig.toml` sets `minimumReleaseAge` to 3 days, `trustedDependencies` is an empty list
(this also turns off Bun's built-in trust list; esbuild works without its postinstall), and
`.github/dependabot.yml` opens grouped weekly PRs with a matching cooldown, skipping `better-auth` 1.7+ and
`@playwright/test` (bumped by hand with the CI image).

## API keys (roadmap 1.1)

- Keys are sent only to their own provider's origin (the one exception is the opt-in durable run below). The
  transport builds headers; no other code touches the key.
- "Session only" keeps the key in memory. "Remember" stores it in IndexedDB encrypted with a non-extractable
  WebCrypto `CryptoKey`. Be honest in the UI: this stops someone copying the browser profile, not malicious script.
- Never show a full key after saving (show the last 4 characters). Never put keys in URLs, exports, or sync payloads.
- Recommend scoped keys with spend limits. OpenRouter's OAuth flow lets users cap the minted key.
- Anthropic needs `anthropic-dangerous-direct-browser-access: true` for browser calls. The name is a warning about
  exposing *your own* key in a public site; with user-supplied keys it's the intended BYOK pattern.

*Where it stands (1.1, 2026-10-26).* The vault is `src/lib/keys/`; other code reads a key only through
`getProviderKey(providerId)` (`index.ts`).
- **Adding a provider** is one entry in `src/models/provider-registry.ts` (name, key page, API origins, chat base
  URL, key test, native ids). Its `apiOrigins` widen `connect-src`, so check the provider's CORS from a browser
  first, update the pinned list in `provider-origins.test.ts`, and say so in the PR. Tests fail if any of the
  entry's URLs sits outside its own origins.
- **Storage.** Session keys sit in a `Map` in the vault module. Remembered keys are AES-GCM encrypted (random IV, the
  provider id as additional data, so a record moved to another provider won't decrypt) under one non-extractable
  device key, both in their own IndexedDB database `highelo-keys`. No cache: every read decrypts, so a key deleted in
  one tab is gone in the others.
- **Who sends keys.** Besides the chat transport, only the key test (`test-key.ts`) puts a key in a request: one GET
  to the provider's own API, key in a header (Google's too, never `?key=`), `credentials: "omit"`,
  `referrerPolicy: "origin"`. Error bodies are never read, since some quote the key. OpenRouter's, Hugging Face's and
  AI Gateway's model lists are public, so their tests call `/api/v1/key`, `huggingface.co/api/whoami-v2` and
  `/v1/credits`. `huggingface.co` was added to `connect-src` for this.
- **Forms.** The settings routes render client-only (`ssr: false`), and the key input has no `name`, so even a
  native form submit has nothing to send to our server.
- **Connect OpenRouter** (`openrouter-oauth.ts`): PKCE S256 plus `state`. The verifier and state wait in
  sessionStorage, are removed before the exchange (one use), and expire with the code after 10 minutes. A callback
  that this tab didn't start makes no request. The page strips `?code=&state=` with `history.replaceState` first.
- **Scrubbing.** `redact()` now also knows Cerebras (`csk-`) and Together (`tgp_`) keys and `code_verifier`, and
  scrubs every key the vault has saved or read by exact match (`registerSecret`), which covers keys with no prefix
  (Mistral, older Together and Fireworks keys).
- **Tested.** `e2e/keys.spec.ts` fakes every provider origin and records every request and Convex WebSocket frame:
  each key appears only in requests to its own provider. It also checks reload behavior per mode, that IndexedDB
  holds no plaintext and a non-extractable key, the PKCE exchange, and that a planted callback connects nothing.

*Chat (1.2, 2026-10-27).* `src/lib/chat/browser-transport.ts` reads the key with `getProviderKey` per request
and hands it to that provider's AI SDK client (`language-model.ts`), whose base URL is one of the `connect-src`
origins. Anthropic gets `anthropic-dangerous-direct-browser-access: true`; Google gets the key in
`x-goog-api-key`. Provider error messages and bodies are never shown or logged (they can quote the prompt or the
key): `chat-errors.ts` turns the HTTP status into a fixed sentence, and logs carry only the error name and status.
Tested: `language-model.test.ts` sends one request per provider
and checks each key reaches only its own origin, in a header; `e2e/chat-keys.spec.ts` chats through a faked
OpenRouter and checks the key went nowhere else (our server and Convex included).

*Model picker (2.2, 2026-10-27).* The picker sends no key anywhere. The catalog is a public Convex query, read with
a plain HTTP POST (`src/lib/models/catalog.ts`); runnability is worked out in the page from which providers have a
key (`listProviderKeys`, summaries only). The only other request is the local server's `/models`, made the first
time the picker opens (never on page load, so Chrome's local network prompt can't appear unasked), with no key and
`credentials: "omit"`. Catalog text (names, descriptions) renders as plain React text, never HTML.

*Host choice (2.2b, 2026-10-28).* When the picker opens, the page GETs the public endpoint lists for the previewed
model from `openrouter.ai/api/v1/models/{id}/endpoints` and `ai-gateway.vercel.sh/v1/models/{id}/endpoints`
(`src/lib/hosts/use-endpoints.ts`): no key, `credentials: "omit"`, `referrerPolicy: "no-referrer"`, only the public
model id in the path. Both origins were already in `connect-src`. The answers are third-party data, so every field
is validated (`endpoint-stats.ts`) and provider names render as plain text. Router options (OpenRouter's
`provider.order` / `sort` / `data_collection`, the Gateway's `order` / `sort` / `disallowPromptTraining`) go in the
provider's own request body, built in `routing-options.ts`. "Only hosts that don't train on my data" is enforced by
the router where it can be (`data_collection: "deny"`, `disallowPromptTraining`); for direct keys it relies on the
Gateway's published flags, and hosts with no published policy are excluded. This browser's failures per host
(`highelo-host-failures`) store a host id, HTTP status and time, nothing else. Key changes are announced to other tabs
on a BroadcastChannel whose only message is "changed".

## Server-held keys for durable agent runs (opt-in, roadmap decision 25)

The only case where a key reaches our backend. Rules:
- **Consent screen first.** It explains that the key will be stored on our server for this run and deleted when
  the run ends. It recommends a dedicated key with a spend limit, and links to that provider's key-management page
  so the user can revoke it afterwards. Keep provider key-page URLs in `curation.ts` and check them when adding providers.
- **Envelope encryption.** A random data key per stored API key encrypts it (AES-GCM). The data key is encrypted with
  a master key held in a Convex environment variable, never in the database. Ciphertext is readable only by the
  internal action executing the run. No query or mutation ever returns it, and it never appears in logs.
- **Scoped and short-lived.** Bound to the user and the run id. Hard-deleted (not soft-deleted) when the run
  completes, fails, or is cancelled, plus a scheduled sweep that deletes anything older than 24 hours as a backstop.
  "Keep for future runs" is opt-in and deletable any time from settings.
- **Visible.** Settings lists stored keys with when they were last used and by which run, and a "Delete now" button.
- **Backups.** Check Convex backup retention, and state honestly in the privacy policy how long an encrypted key
  could survive in a backup.

## Permission modes and YOLO (roadmap decision 26)

| Mode | Behavior |
|---|---|
| Ask | Every tool call asks first. |
| Read-only auto *(default)* | Read-only tools run; anything with side effects asks. |
| Auto except risky | Everything runs except the always-ask list below. |
| YOLO | Everything runs except the always-ask list below. The data-flow rule (see "Agents") also stays on. |

**Always ask, in every mode:** spending or moving money, deleting the user's data, sending messages or posting
publicly on the user's behalf, changing account or security settings, adding MCP servers / skills / plugins, and
entering credentials anywhere.

**YOLO scope.** Per chat, off by default, expires when the run ends, and shown with a persistent banner and in the
tab title. It's disabled automatically in group chats and shared workspaces, because a chat containing other people's
messages is untrusted input and the agent could leak their content.

**Who YOLO affects.** Mostly the person who turned it on: their keys, spend, data, and connected accounts. It
reaches others when the agent acts outward (emails, posts, requests to third-party sites) or reads other people's
content (group chats). It can also load our infrastructure (the fetch proxy), which is why rate limits and the
enforcement layers (CSP, sandbox origin, SSRF checks) are never part of what YOLO skips.

## Local model servers (roadmap 2.3)

- **CORS.** By default a local server rejects requests from other websites. "Enable CORS" in LM Studio (as far as
  we know, an all-or-nothing switch) lets every website the user visits call their local model. Ollama can allow
  only our origin with `OLLAMA_ORIGINS=https://<our-domain>`.
- **Detect, then warn.** On "test connection", read `Access-Control-Allow-Origin`. If it's `*`, show the warning
  with safer setup steps, plus a per-endpoint "don't show again". If it echoes only our origin, show a green check.
- **Chrome Local Network Access.** Chrome asks the user before a public site can reach `localhost`, and a denial is
  sticky. Show our own explainer first, trigger the request from a user click, and handle denial with instructions.
- Never call local endpoints in the background on page load. Only after the user has added one.

*Where it stands (2.3, 2026-10-29).* Endpoints live in `src/lib/local-endpoints/`, the Settings UI in
`src/components/settings/local-endpoint*.tsx`.
- **The header isn't readable.** Browsers hide `Access-Control-Allow-Origin` from scripts unless the server lists
  it in `Access-Control-Expose-Headers`, and LM Studio and Ollama don't. So "Test connection" uses the header when
  it can, and otherwise asks again from a worker started from a `data:` URL (`cors-check.ts`). That worker's
  origin is opaque, so it sends `Origin: null` like a sandboxed page on another site would. Allowed: every origin
  can use the server (warning). Refused: only listed origins can (green check). A `no-cors` request first checks
  the worker reaches the server at all; if it doesn't, we say we couldn't tell instead of showing the check.
  This needed `worker-src data:`; starting a worker already takes running script, and it inherits `connect-src`.
- **Only localhost and 127.0.0.1.** Saving refuses any other host, LAN addresses included. `connect-src` allows
  only those two (any port), and widening it to private ranges would let an injected script reach every device on
  the user's network. For a model on another machine, forward a local port (`ssh -L`). `[::1]` isn't allowed
  either; add it to `LOCAL_MODEL_ORIGINS` first if someone needs it.
- **Local Network Access.** Our explainer shows before the first request (once per browser), and "Continue" sends
  it. After a failed request we ask the Permissions API (`loopback-network`, `local-network-access`, then
  `local-network`, since Chrome renamed it) and show re-allow steps when it's `denied`. The picker asks saved
  endpoints for their models only when it opens.
- **Limits** (quality audit G3). Listing a server's models gives up after 5 s, body included, and says it timed
  out. It keeps the first 1,000 ids and drops ids longer than a `ModelChoice` can hold (200 characters), so a
  stuck or hostile server can't hang the picker or swamp the page.

## Agents and tools (Phase 4)

The industry consensus: **you cannot filter your way out of prompt injection; you limit what an injected model can do.**

- **Break the "lethal trifecta"** (private data + untrusted content + a way to send data out). Meta's "Rule of Two":
  in one turn, an agent may have at most two of: (A) untrusted input, (B) sensitive data or systems, (C) the ability
  to change state or communicate externally. Implementation: once a turn has read untrusted content (web page,
  file, MCP result), any tool that sends data out or changes state requires explicit approval for the rest of that turn.
- **Least privilege.** Tools are read-only by default, and each tool declares its risk level. Side-effecting tools
  require approval (AI SDK 7 approval policies; the HMAC option binds the approved arguments so they can't be
  swapped after approval).
- **Patterns for bigger agents.** Plan-then-execute: the plan is fixed from the user's request before any
  untrusted content is read. Dual LLM: a "reader" call with no tools summarizes untrusted pages, and only its
  summary reaches the planner. CaMeL-style data-flow tracking is the strongest option known, at some cost in
  usefulness. Worth it only for high-risk tools.
- **Server fetch proxy (SSRF).** Resolve DNS and block private, loopback, link-local, and cloud-metadata IP ranges.
  Re-check after every redirect. Cap response size and time. Only `http(s)` schemes. No cookies forwarded.
- **MCP.** User-added servers only. Show each tool's description, pin a hash of the tool definitions, and warn when
  they change (a "rug pull"). Approvals on by default.
- **Memory (later).** Treat memory writes as untrusted input that the user can see and delete; never let
  retrieved memory grant new tool permissions.

## Convex

- The only public functions are `users.getOrCreate` and the catalog queries `models.list` / `models.get`.
  `convex/publicFunctions.test.ts` fails on any public query, mutation or action that `src/` and `e2e/` never call
  as `api.<module>.<name>`, unless it's allowlisted there with a reason. Delete functions the app stops using.
- The old chat backend (messages, conversations, group chats, sharing, attachments with `generateUploadUrl`,
  branching, usage, pins) was deleted unused on 2026-10-30 (quality audit D1). Restore from git at `58853e2`. Its
  mutations checked membership and authorship, so clients couldn't write `streaming` partials, other users'
  messages, or usage records (audit items 1–3); anything restored for 6.1 or 6.3 keeps those checks and gets 6.2's
  rate limits.
- Public queries return projections, never whole documents. Share IDs come from `crypto.getRandomValues`.
- Rate limits on sync, share creation, and invites (roadmap 6.2).

## Accounts

Sign-up and password reset must not reveal whether an address has an account, by their answer or by how long they
take (fixed 2026-10-25; checked through the real HTTP router by `convex/auth.test.ts`).
- **Same answer.** Forgot-password shows one message for every address. `/sign-up/email` answers
  `{ token: null, user: null }` for a new or a taken address (`convex/lib/hideAccountExistence.ts`); before, Better
  Auth's stand-in user for a taken address had a different shape (dates as strings, extra null fields, another id
  format). The 503 from `convex/emailGuard.ts` depends only on config, not the address.
- **Same time.** Only a real account gets a reset email, and only a new address gets a verification email, so a
  request that waited on Brevo was slower exactly when it gave something away. Reset and verification emails are now
  queued (`queueEmail` in `convex/email.ts`, which schedules `email:deliver`) instead of sent inside the request. Not
  Better Auth's `backgroundTasks` hook: Convex may drop work an action leaves running after it returns. The leftover
  database work still differs, so the reset and sign-up responses also wait out a floor (`RESPONSE_FLOOR_MS`:
  500 ms and 1,000 ms) measured from Better Auth's before hook. If Convex logs say a route ran "past its … ms floor",
  raise the floor. Better Auth's own `/send-verification-email` already has a 500 ms floor.
- **Queued links.** A scheduled function's arguments (here the address and the link) stay in `_scheduled_functions`
  for 7 days after it runs, readable in the dashboard. The links expire within an hour, and a reset token works
  once. Anyone with dashboard access can already read the `verification` table and `BETTER_AUTH_SECRET`, so
  queueing gives no one new access. Don't queue anything longer-lived than these links.

## Testing

- Playwright tests that render malicious model output (script tags, `javascript:` links, reference-style links,
  remote images, huge payloads) and assert nothing executes or loads.
- A CSP test asserting the header is present and enforced.
- Both exist since 1.0: `e2e/xss.spec.ts` renders the payloads in `src/routes/e2e/-xss-payloads.ts` through
  `/e2e/markdown`, and `e2e/csp.spec.ts` checks the headers, the nonce, and that violations are reported (or, for
  the enforced subset, blocked). Add a payload there when a new bypass is published.
- For Phase 4, an injection suite: pages and files with hidden instructions, asserting that no data-sending tool
  runs without approval. Tools like promptfoo can generate variants.
