# Data inventory

What data the app touches, where it lives, who else sees it, and how long it's kept. This is the source for the
privacy policy and terms (roadmap 7.1). **Any slice that adds, moves, or stores data updates this file in the same PR.**

Started 2026-10-20. "Today" means the code at that date; "Planned" refers to roadmap slices.

## Commitments (seed of the privacy policy)

Promises the design already makes. Changing one of these is a product decision, not an implementation detail.

1. We never pay for or proxy your model usage. Prompts and replies go from your browser straight to the provider you
   chose, under your own account with that provider.
2. Your API keys stay in your browser. The only exception is a durable agent run you explicitly opt into, where the
   key is stored encrypted for that run and deleted when it ends unless you choose to keep it.
3. Chats are stored on your device by default. They reach our servers only if you turn on sync, share a chat, or
   join a group chat.
4. Analytics never include prompts, replies, file contents, or keys. You can turn analytics off.
5. You can export your data and delete your account and cloud data.

## Data map

| Data | Where it lives | Who can see it | Kept for | Status |
|---|---|---|---|---|
| Account profile: name, email, avatar URL, email-verified flag | Convex (Better Auth `user`, app `users`) | You; us as operators | Until account deletion | Today |
| Password hash (email sign-in) | Convex (Better Auth `account.password`) | Nobody in plain text | Until account deletion | Today |
| Linked sign-in accounts (Google / GitHub / Discord): provider, provider account ID, granted scope | Convex (Better Auth `account`) | Us as operators | Until unlinked or account deletion | Today |
| OAuth tokens from Google / GitHub / Discord (access, refresh, id tokens) | Not stored. A Better Auth `databaseHooks.account` hook nulls them on every account write (roadmap 0.3, 2026-10-25) | Nobody | Not kept | Since 0.3. Rows written before it are cleared by `authMaintenance:clearStoredOAuthTokens`, which the owner runs once per deployment |
| Queued auth emails: your address, the subject, and the verification or reset link | Convex `_scheduled_functions` (the `email:deliver` arguments; docs/security.md, "Accounts") | Us as operators (dashboard) | 7 days after it's sent; the link itself expires within an hour | Since 2026-10-25 |
| Sessions: IP address, user agent, expiry | Convex (Better Auth `session`) | Us as operators | Until session expiry | Today |
| Email verification and password-reset tokens | Convex (Better Auth `verification`), reset tokens only: a verification token is a signed JWT that isn't stored, and expires after an hour. Both are in the emailed link's URL, so in your browser history. A reset link lands on `/reset-password?token=…`, which sends the token only in the reset request's body | Nobody; the link reaches you through Brevo and our code never logs it. Vercel's request logs may record the page URL with its token | Until used or expired (a reset token works once) | Today; sign-up and reset pages since 2026-10-25 |
| Conversations and messages (text, reasoning, model used, token usage, feedback) | Convex today; **IndexedDB on your device** after 1.3 | You (and group members / share-link viewers if you share) | Until you delete them | Today in Convex; moving local-first in Phase 1 |
| Attachments (images, PDFs, files) | Convex file storage today; IndexedDB after 1.6 | Same as messages | Until you delete them | Today / planned |
| Usage events (model, tokens, cost estimate) | Convex today; local only after Phase 1 | You; us as operators while in Convex | Until account deletion | Today; moving local |
| Provider API keys | Your browser: "This session only" keeps it in the tab's memory; "Remember on this device" keeps it in IndexedDB (`highelo-keys`), AES-GCM encrypted under a non-extractable key stored next to it, with the last 4 characters in plain text for display | Only the provider it belongs to (a key test, and from 1.2 your chats). Never our server, Convex, logs, URLs or exports | Session keys: until reload or tab close. Remembered keys: until you delete them or clear site data | Since 1.1 (2026-10-26) |
| OpenRouter sign-in (Connect OpenRouter): a one-time PKCE verifier and state, then a one-time code in the callback URL (`/settings?code=…&state=…`) | Verifier and state: your tab's sessionStorage until the sign-in finishes (codes expire after 10 minutes). Code: the callback URL, removed from the address bar and history as the page loads | OpenRouter. The code also reaches Vercel's request log as part of the URL, but it's useless without the verifier, which never leaves your browser except to OpenRouter | Verifier: until used. Code: Vercel log retention | Since 1.1 (2026-10-26) |
| Server-held key for durable agent runs | Convex, envelope-encrypted | The run that uses it | Deleted at run end, or kept until you delete it | Planned (4.1, opt-in) |
| Local model endpoint URLs | Your browser | Nobody else | Until you delete them | Planned (2.3) |
| Prompt library and versions | Your browser; Convex if synced | You | Until you delete them | Planned (3.6) |
| Settings and preferences (theme, default model, notification choices) | Your browser; Convex `users.preferences` if signed in | You | Until changed or account deletion | Partly today |
| Synced chats | Convex | You (and group members) | Until you delete them or turn off sync | Planned (6.1) |
| Shared chat snapshots | Convex | Anyone with the link | Until you unshare | Backend exists; UI planned (6.3) |
| CSP violation reports: the policy directive, the blocked origin (or `inline`/`eval`), and the page path; the browser also sends the page URL, user agent and a script sample, which are dropped before logging | Vercel function logs (one `[csp]` line each, from `/api/csp-report`); nothing stored | Us | Vercel log retention | Since 1.0 (2026-10-25) |
| Product analytics events (no content) | Analytics provider (TBD, cookieless) | Us | Provider retention (TBD) | Planned (1.8) |
| Error reports (scrubbed of keys and content) | Sentry | Us | Sentry retention (TBD) | Planned (1.8) |
| Model catalog | Convex `models` | Public | Ongoing | Planned (2.1); not user data |

## Third parties

| Service | What it receives | Why | Status |
|---|---|---|---|
| Convex | Everything stored in Convex above | Database, auth storage, file storage | Today |
| Vercel | Requests to our pages and server routes (IP, user agent); no keys or prompts after Phase 1 | Hosting | Today |
| Google, GitHub, Discord | The sign-in handshake | OAuth sign-in | Today |
| Brevo | Your email address and the message | Verification and password-reset emails | Today |
| AI providers you connect (OpenAI, Anthropic, Google, OpenRouter, …) | Your prompts, files, and key, sent directly from your browser | Generating replies | Today via our server for LM Studio; browser-direct from Phase 1 |
| The provider of a key you test (settings → API keys) | The key, in one request to its own API (a model list, or for OpenRouter, Hugging Face (`huggingface.co`) and AI Gateway an account endpoint), with our origin but no page path | Checking the key works | Since 1.1 |
| OpenRouter (Connect OpenRouter) | The sign-in on their site; then the code and verifier, from your browser, in exchange for a key you own | Making a key without copy-paste | Since 1.1 |
| Your local model server (LM Studio, Ollama) | Your prompts, from your browser to your own machine | Local generation | Planned (2.3) |
| AI Gateway (public catalog), Artificial Analysis | Nothing about users; our server fetches public model data | Model catalog | Planned (2.1) |
| Analytics provider, Sentry | Content-free events and scrubbed errors | Product analytics, debugging | Planned (1.8) |

## Open items for the policy

- Convex region and backup retention (affects what we can promise about deletion).
- Account deletion and export flow (roadmap 7.2).
- Analytics and Sentry providers and their retention settings.
- Minimum age and acceptable-use terms, including responsibility for what users do with agents in YOLO mode.
