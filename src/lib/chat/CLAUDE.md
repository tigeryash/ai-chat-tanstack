# Chat in the browser

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.

- **AI SDK 7, chat in the browser** (roadmap 1.2, `src/lib/chat/`). Chat routes (`/new`, `/$chatId`, both
  `ssr: false`) run `useChat` on `Chat` objects from `chat-sessions.ts`, which outlive a route (so `/new` hands a
  streaming chat to `/$chatId`) and save to the ChatStore when a reply finishes. `open-chats.ts` tracks them
  (and releases idle ones past 8; a route showing a chat calls `retainChat`). Never `openChat(id)` in render for a
  saved chat: a released one comes back empty and its next save wipes the history; use `openSavedChat`.
  `BrowserChatTransport` runs `streamText` in the page against the provider in each request's `body`
  (`language-model.ts`; local models get the `<think>` middleware). Tests use `mockChatModel` (`mock-model.ts`) and
  the `/e2e/chat` pages; `VITE_E2E` builds also map the local model `e2e-mock-model` to it, so e2e can drive `/new`.
- **Reply metadata** (`ReplyMetadata` in `browser-transport.ts`): model, host and cost (`reply-host.ts`, 2.2b),
  tokens, TTFT and tokens/sec (`reply-stats.ts`, 2.5; timed in the page from the request), and the saved
  prompt version it was sent with (`prompt`, 3.6b, `lib/prompts/provenance.ts`). Saved and imported
  chats are untrusted, so read it back through `replyDetails` / `readReplyStats`; `chat-usage.ts` totals a chat.
  Nothing shows inline under a reply; the "⋯" popover lists model, host, cost, tokens and timings from
  `replyDetails` (`reply-details.ts`, 2.5b).
- **New-chat defaults and titles** (Refine R2 S2, Settings → General). `readChatModelChoice` falls back to
  `default-model.ts` (last pick, or a fixed model). A title model (`title-model.ts` setting,
  `chat-title-writer.ts`) starts writing when a chat opened empty first sends, and `saveChat` waits for it so the
  title lands in the first write; any failure falls back to the first line, and nothing about it is logged.
  Read a `createLocalStore` inside a hook through a `use…`-named function: the React Compiler caches a bare
  `store.use()` call.
