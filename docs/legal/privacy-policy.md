# Privacy Policy

> **Draft. Not legal advice: have a lawyer review before public launch.** This draft is built from the project's data inventory and is revised as features land.

Last updated: 2026-11-09

High Elo LLMs ("the app", "we", "us") is an independent, non-commercial project run by its developer, an individual based in Ontario,
Canada. You can reach us at support@highelollms.com.
This policy explains what data the app handles, where it lives, who receives it, how long it's kept, and how
you can export or delete it.

## The short version

- **Your API keys stay in your browser.** They're sent only to the AI provider they belong to, never to our
  servers. The one exception is a future, opt-in "durable agent run" (see below).
- **Your chats, attachments and saved prompts are stored on your device.** They reach our servers only if you turn on sync, share a chat, or
  join a group chat. None of those features is live yet.
- **We never see your prompts, files or replies.** They go from your browser straight to the provider you choose, under
  your own account with that provider.
- **Analytics and error reports never include content.** No prompts, replies, file contents, or keys. You can
  turn both off in Settings.
- **An account is optional.** You can chat without one. You need one only for cloud features.

## What stays in your browser

Most of what the app stores never leaves your device. It lives in your browser's storage for this site
(IndexedDB, localStorage and sessionStorage), and anyone with access to your browser profile can read it.

- **Chats.** Titles, messages (text, reasoning, files, tool calls and results), which model and host answered
  each reply, its cost, token counts and speed, timestamps, whether a chat is pinned, and which account on this device made it.
  When you edit a message, the earlier versions and the replies they had are kept too, so you can switch back
  to them; deleting the chat deletes them. Exports include them.
  Stored in IndexedDB. The app asks your browser to keep this data, but browsers can still clear it: Safari may
  delete it after 7 days without a visit. Exporting your chats is the backstop.
- **Attachments.** Images (PNG, JPEG, WebP, GIF) and PDFs you attach to a message, up to 20 MB each and 10
  per message, with their file names and types. The app shrinks images (except GIFs) in your browser before
  sending them. Stored in IndexedDB with the chat they belong to, and included in chat exports. They're deleted
  with their chat, or when no message or earlier version of a message refers to them any more.
  Text and code files (plain text, Markdown, CSV, JSON, YAML, XML, source code and similar), up to 1 MB each, are
  stored the same way. Your browser reads their contents and sends them to the provider as text inside your
  message, with the file name.
- **System prompts.** A chat's own system prompt, if you set one, is stored with the chat and included in exports.
  The default system prompt for chats without their own is stored in IndexedDB and isn't exported.
- **Saved prompts.** Prompts you save in the prompt library: each one's name, tags, which account on this device
  saved it, every version of its text (up to 200 per prompt) with when it was saved, and the models it's the
  default prompt for. Stored in IndexedDB and included in exports. A saved prompt leaves your device only as a
  chat's system prompt, sent to that chat's provider: when you apply it to a chat, or when it's the default for
  the chat's model. Each reply records which saved prompt and version it was sent with (an id and a number, not
  the text), stored with the chat and included in its exports.
- **Workspaces.** Which chats sit side by side, in what order, each pane's width and whether it's synced, and
  which account on this device made it. No messages: those stay with each chat. Stored in IndexedDB, and included
  in exports (only the panes whose chats are in the same file).
- **Saved layouts.** A name you give, and for each pane its model and host choice, width and sync switch. No
  chats, messages or keys. Up to 20, stored in localStorage and shared by every account in this browser, so an
  export includes all of them.
- **API keys.** "This session only" keeps a key in the tab's memory until you reload or close the tab.
  "Remember on this device" stores it in IndexedDB, encrypted with a key your browser won't let any script
  export, with the last 4 characters visible so you can recognize it. This protects against someone copying
  your browser profile, not against malicious code running in the page.
- **Settings and choices.** Your chosen models and hosts, picker view, hosting preferences (including hosts you
  block, a minimum precision and a price cap), local model servers you add, background status and notification
  settings, and a few "already seen" flags. Stored in localStorage. Hosting preferences also go, with each
  request, to the router you send it through (OpenRouter or Vercel AI Gateway), never to us.
- **Recent host failures.** The host, error status and time of failed requests, forgotten after 15 minutes. No
  content.

This data stays until you delete it in the app, clear your browser's site data, or your browser evicts it.

**Signing out on a shared device.** The app shows an account's chats and saved prompts only while that account
is signed in here, but that's hiding, not encryption: they stay readable in this browser profile. Use "Sign out
and remove my chats from this device" to delete them (it removes that account's saved prompts too).

## What we store on our servers

Our backend is [Convex](https://www.convex.dev). Today it holds account data, plus the security report counts
described under [Security reports](#security-reports), which aren't about you.

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
  Gateway). Your prompts, the chat's system prompt, files you attach and your API key go **directly from your
  browser** to the provider you chose, under your own account and that provider's terms and privacy policy. Each
  new message sends the conversation so far, so attachments and the system prompt go again with every later
  message in that chat. Text and code files go as part of your message's text: their name and full contents. We don't proxy, see or pay for these requests.
  What the provider keeps, and whether it trains on your data, is between you and the provider. The app can
  filter to hosts that say they don't train on your prompts, but we rely on what those hosts publish.
- **Testing a key** sends it once to its own provider to check it works.
- **Connect OpenRouter** sends you to OpenRouter's site to sign in, then exchanges a one-time code from your
  browser for a key you own.
- **Model status in the picker.** When you open the model picker, your browser fetches public host status (prices,
  uptime, latency) from OpenRouter and Vercel AI Gateway. They see your IP address and which models you looked
  at, but no key or cookies.
- **Your local model server** (LM Studio, Ollama). Prompts and attachments go from your browser to the server on your own
  machine (localhost). Nothing is sent there until you add the server in Settings.
- **Convex** stores the server data listed above.
- **Vercel** hosts the app. It receives your requests to our pages (IP address, user agent, the page address)
  and keeps request logs for 1 hour. No keys or prompts pass through it. A model link (`/new?models=…`) puts
  the model names in the page address, so they reach these logs, your browser history, and anyone you share
  the link with. Model links never contain keys, prompts, chats or local models.
- **Brevo** sends our verification and password-reset emails, so it receives your email address and the
  message.
- **Google, GitHub and Discord**, if you sign in with them. They take part in the sign-in and share your name,
  email and avatar with us.
- **Vercel Web Analytics and Speed Insights**: page views and page-speed measurements. They use
  no cookies, see only the page's route (never chat IDs, codes or tokens in the address), never include
  content, and keep data for 1 month. You can turn them off in Settings, and we honor Global Privacy Control
  and Do Not Track.
- **Sentry** receives error reports when something breaks in the app: the kind of error, a shortened error
  message with keys, quoted text and web address details removed, where in our code it happened, the kind of
  page (such as "a chat" or "settings", never a chat ID or the rest of the address), the pages you moved
  between just before, and your browser and operating system. Never prompts, replies, files or file names,
  keys, request contents, cookies, your email or your account. We ask Sentry not to store your IP address.
  Reports are kept for 30 days. They use no cookies, and they're off whenever analytics are off: the Settings
  switch, Global Privacy Control and Do Not Track turn off both.

We don't sell your data, and we don't share it for advertising.

## Security reports

If your browser blocks something our security policy (CSP) doesn't allow, it sends us a report. We keep only the
rule, the blocked origin (a site name such as `https://example.com`, never a full address) and the kind of page (such
as "a chat" or "settings", never a chat ID, query or fragment), and drop the rest, including your IP address and
browser details. These go in Vercel's logs (kept 1 hour) and as a running count per rule, origin and kind of page
in Convex, deleted 30 days after the last matching report. Nothing in them identifies you.

## Cookies and local storage

We use cookies only to keep you signed in (a session cookie set by our sign-in system, Better Auth). We don't use
advertising or tracking cookies. Analytics are cookieless.

The app also uses your browser's local storage (IndexedDB, localStorage, sessionStorage) for the data in "What
stays in your browser". It stays on your device.

If you allow notifications, the app can show "Reply ready" or "Reply failed" with the chat's title, never
message content.

## Exporting and deleting your data

- **Chats:** delete them in the app, or export them as a file (JSON) in Settings → Your data and import them
  elsewhere. Exports include the chat's attachments and system prompt, and never include API keys. Deleting a chat
  deletes its attachments.
- **Saved prompts:** delete them in the prompt library. They're included in the same export file as your chats.
- **Workspaces and saved layouts:** delete them from the sidebar and in Layouts. Both are included in the same
  export file; importing keeps whichever copy is newer.
  Clearing your browser's site data for this app deletes everything stored in the browser.
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

We're based in Ontario, Canada. Convex stores our server data in the United States, and Vercel, Sentry and Brevo may
process it in the United States and other countries where they operate, so it may be handled under those
countries' laws. For data from the EU or UK, Vercel and Sentry are certified under the EU-U.S. Data Privacy Framework
and its UK Extension. Convex covers transfers in its Data Processing Agreement. Brevo is based in the EU. AI providers you connect process your prompts wherever they operate, under their own terms.

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
  understanding how it's used through cookieless, content-free analytics. You can turn analytics and error
  reports off in Settings.
- **Consent:** notifications and anything else the app asks you to turn on. You can withdraw it at any time.

We don't sell your data, use it for advertising, or make automated decisions about you that have legal or
similarly significant effects.

## Changes

We'll update this policy as features change, and change the "Last updated" date at the top. For significant
changes we'll also post in the app's changelog and show a notice in the app before they take effect.

## Contact

Questions or requests about your data: support@highelollms.com
