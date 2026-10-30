# Privacy Policy

> **Draft. Not legal advice: have a lawyer review before public launch.** This draft is built from the project's data inventory and is revised as features land.

Last updated: 2026-10-30

High Elo LLMs ("the app", "we", "us") is an independent, non-commercial project run by its developer, an individual based in Ontario,
Canada. You can reach us at support@highelollms.com.
This policy explains what data the app handles, where it lives, who receives it, how long it's kept, and how
you can export or delete it.

## The short version

- **Your API keys stay in your browser.** They're sent only to the AI provider they belong to, never to our
  servers. The one exception is a future, opt-in "durable agent run" (see below).
- **Your chats are stored on your device.** They reach our servers only if you turn on sync, share a chat, or
  join a group chat. None of those features is live yet.
- **We never see your prompts or replies.** They go from your browser straight to the provider you choose, under
  your own account with that provider.
- **Analytics never include content.** No prompts, replies, file contents, or keys. You can turn analytics
  off in Settings.
- **An account is optional.** You can chat without one. You need one only for cloud features.

## What stays in your browser

Most of what the app stores never leaves your device. It lives in your browser's storage for this site
(IndexedDB, localStorage and sessionStorage), and anyone with access to your browser profile can read it.

- **Chats.** Titles, messages (text, reasoning, files, tool calls and results), which model and host answered
  each reply and its cost, timestamps, whether a chat is pinned, and which account on this device made it.
  Stored in IndexedDB. The app asks your browser to keep this data, but browsers can still clear it: Safari may
  delete it after 7 days without a visit. Exporting your chats is the backstop.
- **API keys.** "This session only" keeps a key in the tab's memory until you reload or close the tab.
  "Remember on this device" stores it in IndexedDB, encrypted with a key your browser won't let any script
  export, with the last 4 characters visible so you can recognize it. This protects against someone copying
  your browser profile, not against malicious code running in the page.
- **Settings and choices.** Your chosen models and hosts, picker view, hosting preferences, local model servers
  you add, background status and notification settings, and a few "already seen" flags. Stored in localStorage.
- **Recent host failures.** The host, error status and time of failed requests, forgotten after 15 minutes. No
  content.

This data stays until you delete it in the app, clear your browser's site data, or your browser evicts it.

**Signing out on a shared device.** The app shows an account's chats only while that account is signed in here,
but that's hiding, not encryption: the chats stay readable in this browser profile. Use "Sign out and remove my
chats from this device" to delete them.

## What we store on our servers

Our backend is [Convex](https://www.convex.dev). Today it holds account data only.

| Data | Why | Kept for |
|---|---|---|
| Your name, email, avatar URL and whether your email is verified | Your account | Until you delete your account |
| A hash of your password (email sign-in only; never the password itself) | Signing in | Until you delete your account |
| Which Google, GitHub or Discord account you linked (provider, account ID, granted scope). We don't keep their access or refresh tokens | Signing in | Until you unlink it or delete your account |
| Sessions: IP address, browser user agent, expiry | Keeping you signed in | Until the session expires |
| Email verification and password-reset tokens | Confirming your email, resetting your password | Until used or expired (within an hour) |
| Queued emails: your address, the subject and the link | Sending verification and reset emails | 7 days after sending |

Our backend also holds a public model catalog (model names, prices, scores), which is not about you.

Convex stores this data in the United States (AWS US East, Northern Virginia). We don't keep automatic backups. If we make one by hand (for
example before a risky change), Convex keeps it for 7 days, so deleted data can remain in it until then.

**Planned features that will change this section** (this policy will be updated before each one ships):
syncing chats across devices, sharing a chat by link, group chats, and durable agent runs.

## Who receives your data

- **AI providers you connect** (for example OpenAI, Anthropic, Google, OpenRouter, Hugging Face, Vercel AI
  Gateway). Your prompts, files and API key go **directly from your browser** to the provider you chose, under
  your own account and that provider's terms and privacy policy. We don't proxy, see or pay for these requests.
  What the provider keeps, and whether it trains on your data, is between you and the provider. The app can
  filter to hosts that say they don't train on your prompts, but we rely on what those hosts publish.
- **Testing a key** sends it once to its own provider to check it works.
- **Connect OpenRouter** sends you to OpenRouter's site to sign in, then exchanges a one-time code from your
  browser for a key you own.
- **Model status in the picker.** When you open the model picker, your browser fetches public host status (prices,
  uptime, latency) from OpenRouter and Vercel AI Gateway. They see your IP address and which models you looked
  at, but no key or cookies.
- **Your local model server** (LM Studio, Ollama). Prompts go from your browser to the server on your own
  machine (localhost). Nothing is sent there until you add the server in Settings.
- **Convex** stores the server data listed above.
- **Vercel** hosts the app. It receives your requests to our pages (IP address, user agent, the page address)
  and keeps request logs for 1 hour. No keys or prompts pass through it.
- **Brevo** sends our verification and password-reset emails, so it receives your email address and the
  message.
- **Google, GitHub and Discord**, if you sign in with them. They take part in the sign-in and share your name,
  email and avatar with us.
- **Vercel Web Analytics and Speed Insights**: page views and page-speed measurements. They use
  no cookies, see only the page's route (never chat IDs, codes or tokens in the address), never include
  content, and keep data for 1 month. You can turn them off in Settings, and we honor Global Privacy Control
  and Do Not Track.
- **Error reporting** (planned, likely Sentry): error reports scrubbed of keys and content. This section will
  give its retention before it's turned on.

We don't sell your data, and we don't share it for advertising.

## Security reports

If your browser blocks something our security policy (CSP) doesn't allow, it sends us a report. We log only the
rule, the blocked origin and the page path, in Vercel's logs, and drop the rest.

## Cookies and local storage

We use cookies only to keep you signed in (a session cookie set by our sign-in system, Better Auth). We don't use
advertising or tracking cookies. Analytics are cookieless.

The app also uses your browser's local storage (IndexedDB, localStorage, sessionStorage) for the data in "What
stays in your browser". It stays on your device.

If you allow notifications, the app can show "Reply ready" or "Reply failed" with the chat's title, never
message content.

## Exporting and deleting your data

- **Chats:** delete them in the app, or export them as a file (JSON) and import them elsewhere. Exports never
  include API keys. Clearing your browser's site data for this app deletes everything stored in the browser.
- **API keys:** delete them in Settings → API keys. To revoke a key entirely, do it on the provider's site.
- **Your account:** self-serve account deletion and export are planned. Until then, email us at the address below. We
  delete your account and its server data as soon as we get your request, and always within 30 days.

## Durable agent runs (planned, opt-in)

A future feature will let you run a long agent task on our servers. Only if you opt in for a run, you give us an
API key for that run. We store it encrypted, use it only for that run, and delete it when the run ends, unless
you choose "keep for future runs" (deletable any time in Settings). We'll recommend a dedicated key with a spend
limit. This section will be expanded before the feature ships.

## Children

The app isn't meant for children. You must be at least 18 to use it. That's also
the minimum age for most AI providers it connects to, such as OpenRouter, Anthropic and Google.

## International transfers

We're based in Ontario, Canada. Convex stores our server data in the United States, and Vercel and Brevo may
process it in the United States and other countries where they operate, so it may be handled under those
countries' laws. For data from the EU or UK, Vercel is certified under the EU-U.S. Data Privacy Framework and
its UK Extension. Convex covers transfers in its Data Processing Agreement. Brevo is based in the EU. AI providers you connect process your prompts wherever they operate, under their own terms.

## Your rights

You can see, correct, export or delete your data, and object to how we use it. Most of your data is on your own
device, where you control it directly. For data on our servers, email us (see Contact) and we'll answer within
30 days. We follow the principles of Canada's privacy law (PIPEDA): we collect only what the app needs, use it
only for the reasons in this policy, and keep it only as long as this policy says.

### If you're in the EU or UK

The GDPR and UK GDPR give you the rights above, plus the right to restrict how we use your data and to complain
to your data protection authority (in the UK, the Information Commissioner's Office). Our legal bases are:

- **Contract:** your account data, sessions and sign-in emails, which we need to provide the account you asked
  for.
- **Legitimate interests:** keeping the app secure and working (request and security logs, error reports) and
  understanding how it's used through cookieless, content-free analytics. You can turn analytics off in Settings.
- **Consent:** notifications and anything else the app asks you to turn on. You can withdraw it at any time.

We don't sell your data, use it for advertising, or make automated decisions about you that have legal or
similarly significant effects.

## Changes

We'll update this policy as features change, and change the "Last updated" date at the top. For significant
changes we'll also post in the app's changelog and show a notice in the app before they take effect.

## Contact

Questions or requests about your data: support@highelollms.com
