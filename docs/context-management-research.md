# Context management research (Refine R6)

Research for roadmap R6: what to do when a chat outgrows its model's context window. Strategies covered:
summarising older turns (compaction), trimming (sliding windows), pinning, branching to a fresh chat with a
summary, and how each one interacts with provider prompt caching. Docs only; nothing here is built yet.
Researched 2026-11-16 from official docs, help centers, changelogs and source code. (unverified) marks a
third-party, forum or community source.

## Summary

- **Build our own summariser in the browser, not a provider feature.** Anthropic's compaction returns a signed
  block that only Claude reads. OpenAI's compaction item is encrypted and only works on the Responses API, which
  we don't call. Either one ties a chat to one provider, but our panes switch models and hosts freely. A
  plain-text summary we write with the user's key works on every model, can be shown and edited, and is saved
  locally like any message.
- **First slice: "Continue in a new chat with a summary".** It can't damage a chat. The old chat stays as it
  was, the summary is shown (and editable) before anything is sent, and it builds on the S4 notice that already
  says "Start a new chat". Next comes **in-place compaction** behind a "Compact" action. It saves a summary
  marker in the chat, sends "summary + recent turns" from then on, and keeps the full history visible.
  Automatic compaction comes last and stays opt-in.
- **Defaults:** manual only (the notice offers it at 80%, as S4 does now). Keep the last 4 turns word for word.
  The pane's own model writes the summary, with an optional "Summary model" setting modelled on the title
  model. Every compaction shows a visible divider. Nothing is ever dropped silently.
- **Silent trimming we already have:** OpenRouter applies middle-out "context compression" by default on
  endpoints with 8K context or less, cutting messages out of the middle of the prompt. We should turn it off
  and do our own disclosed handling (slice C0).
- **S4's measure is sound.** The AI SDK's Anthropic provider counts cache reads and writes in `inputTokens`, so
  the ring stays correct when caching kicks in. It can't estimate the *next* send (new message plus files)
  before sending, which compaction needs. A characters ÷ 4 estimate is enough there.

---

## 1. How the code works today

- `stream-reply.ts` sends the **whole** active branch every turn: `convertToModelMessages(messages)` into
  `streamText`, with the system prompt beside it. No trimming, no `pruneMessages`.
- S4 (`src/lib/chat/context-usage.ts`, `src/components/chat/context-status.tsx`) treats the latest reply's
  `inputTokens + outputTokens` as the chat's size and compares it with the pinned host's context length, or else
  the model's. It shows a ring in the pane header and a closable notice at 80% (`CONTEXT_NEARING_RATIO`) and at
  100%, advising "Start a new chat, or pick a model with more context." The notice can be turned off in
  Settings → Chat.
- Usage counting: `@ai-sdk/anthropic` 4.0.98 builds `inputTokens.total` as `input + cache_creation +
  cache_read` (`dist/index.js`, its usage converter), so cached prefixes still count toward the ring. Anthropic's
  own raw `input_tokens` excludes cached tokens ([compaction on demand][a-ondemand]: "`input_tokens` counts only
  the tokens after the last cache breakpoint"), so never read raw provider usage for this.
- Providers (`language-model.ts`): Anthropic direct (`@ai-sdk/anthropic`), Google, Vercel AI Gateway, OpenRouter
  and the others via `@ai-sdk/openai-compatible` (Chat Completions), plus local LM Studio/Ollama. OpenAI is
  reached through Chat Completions, so Responses-only features (compaction, `previous_response_id`) are out of
  reach without a new provider path.
- We don't set Anthropic `cache_control`, so direct Anthropic chats get no prompt caching today (follow-up F2).
- Branches (`storage/branches.ts`): edits and regenerations make versions on a path. A summary saved as a
  message *on the path* fits this naturally. Editing a message above it makes a new branch without the summary,
  which is correct, because that summary described the old branch.

## 2. What products and SDKs do

| Product / SDK | Strategy | Trigger | What the user sees | Who pays / which model | Source |
|---|---|---|---|---|---|
| Claude Code | Summarise in place (auto + `/compact [focus]`), `/clear`, fork | Auto near the limit; stops after repeated thrashing | Summary replaces history in context; "Compact Instructions" in CLAUDE.md steer it | Session model | [how Claude Code works][cc] |
| Claude API: compaction on demand | Server writes a summary block (`compaction: {type: "summarize", instructions?}`) | App decides | Readable `content` + `signature`; must be resent exactly, first in `messages` | Same model, `system`, `max_tokens` as the request | [overview][a-overview], [on demand][a-ondemand] |
| Claude API: threshold compaction | `context_management` edit `compact_20260112` with `trigger`, `pauseAfterCompaction` | Input tokens reach trigger | Happens inside a normal request | Same model ("billed at executor rates", AI SDK types) | [overview][a-overview]; `@ai-sdk/anthropic` `dist/index.d.ts` |
| Claude API: context editing | Clear old tool results / thinking blocks | `trigger` (default 100K input tokens) | Placeholders; client keeps full history | No extra call; invalidates cache from the cleared point | [context editing][a-edit] |
| Claude.ai | Automatic context management | Near the limit (paid plans with code execution) | "Organizing its thoughts"; full history kept; uses more of the usage limit | Claude, on the plan | [Help Center][claude-help] |
| OpenAI Responses | `context_management.compact_threshold`, or stateless `/responses/compact` | Threshold, or app call | Compaction item is "encrypted and opaque … not intended to be human-interpretable" | Not stated | [compaction][oa-compact], [conversation state][oa-state] |
| ChatGPT | Historically a rolling window that silently dropped old turns; Free now stops with "Context window full" (unverified, Nov 2026) | Limit | Hard stop or silent forgetting | n/a | [community thread][chatgpt-forum] (unverified) |
| Cursor | Summarise in place (auto ~90%, `/summarize`); agent can search the history file afterwards | ~90% (staff, unverified) | "Chat context summarized" note; no preview or edit of the summary | Cursor | [changelog 1.6][cursor-16], [blog][cursor-blog] |
| LibreChat | Summarise into a checkpoint + optional tool-result pruning; manual "Compact context" | `token_ratio`, `remaining_tokens`, or message count; on by default | Earlier messages stay visible; reports failures; fixed a gauge bug after summaries | Configurable provider/model, else the agent's own | [summarization config][lc-sum], [PR #13744][lc-gauge] |
| Open WebUI | Summarise older messages, keep a % of recent ones verbatim; `/compact` | Token threshold (default 80K), off by default | Full chat stays displayed; falls back to the full history if the summary fails | "Current model" or a set compaction model | [context window docs][owui] |
| LobeChat (LobeHub) | "Limit history messages" (last N) + optional auto summary into the system prompt | Message count / threshold | History-range divider | Agent's model (unverified) | [helpers tests][lobe-tests], [issue #20903][lobe-20903] |
| TypingMind | "Context limit" = last N messages; optional "Auto summarize long conversations" | Context full | Not documented | Not documented | [parameters][tm-params], [context length][tm-ctx] |
| T3 Chat | Nothing documented | | | | No primary source found |
| OpenRouter | Middle-out context-compression plugin: keeps the start and end, cuts the middle | On by default for endpoints ≤ 8,192 tokens; else opt-in | Nothing, unless you read router metadata | Free (no model call) | [message transforms][or-mt] |
| AI SDK 7 | `pruneMessages` removes reasoning/tool parts by position; no token budget, no summary | App calls it | n/a | n/a | [pruneMessages][aisdk-prune] |

### Lessons from them

1. **Everyone keeps the full transcript visible** and changes only what is *sent* (Claude.ai, Cursor,
   LibreChat, Open WebUI, Anthropic context editing). Losing the visible history is never acceptable.
2. **Summaries lose things.** Claude Code says early instructions "may be lost". Cursor added "keeps your most
   recent message word for word" after complaints, and users ask to preview and edit the summary. So keep recent
   turns verbatim, keep the system prompt outside the summary (Open WebUI rebuilds it every request, after a bug
   where compaction dropped it), and let people see the summary.
3. **Fail safe.** Open WebUI and LibreChat send the uncompacted history when the summary fails. Claude Code stops
   auto-compacting when a single huge input refills the window straight away.
4. **Measuring after a summary is easy to get wrong.** LibreChat had to fix its usage gauge after summaries.
   LobeChat's trigger measured the already-truncated remainder, so compression never ran (#20903).
5. **Silent truncation is the worst case.** ChatGPT users report the model confidently "remembering" dropped turns
   (unverified). OpenRouter's middle-out does this to small-context endpoints.

## 3. Strategies for our app

| Strategy | UX | Cost (user's key) | Correctness risks | Fit |
|---|---|---|---|---|
| **A. New chat with summary** | Action in the S4 notice and palette: writes a summary, opens a new chat with it as an editable first message, links back to the old chat | One summary call | Summary misses details; user can edit it before sending | **Best first step.** Old chat untouched, no transport change, works on any model and pane, easy to test with the mock model |
| **B. Compact in place (manual)** | "Compact" action; divider "Earlier messages summarized · view summary"; history stays visible and greyed above it | One summary call; next request is a cache write on Anthropic/OpenAI, then cheap again | Summary quality; branch edits above the marker (handled by the path). Switching the pane's model is fine: the summary is plain text | Good. Needs a marker part in the message list and a transport change (send system + summary + messages after the marker) |
| **C. Auto-compact** | Same as B, triggered at a threshold before a send; a status line while it runs | Spends money without a click | Surprise spend; thrashing on huge files; latency before the reply | Opt-in only. Hard rule 1 is fine (key stays in the browser), but spending a BYO key silently isn't |
| **D. Sliding window (last N turns / token budget)** | Divider "Older messages aren't sent"; setting per chat | Free | Model forgets the start; trims the prefix every turn, which **misses the cache every turn** on Anthropic (exact-prefix match) | Fallback when summarising fails or for small local models. Trim in big steps, not one message at a time |
| **E. Pin messages** | Pin icon on a message; pinned ones are always sent (after the system prompt) | Free | Pinned order versus time order confuses models; pins can overflow too | Pairs with D/B (pins survive compaction). Later; small |
| **F. Provider-native compaction** (Anthropic block, OpenAI item) | Invisible or semi-visible | Same model; free of our code | Signed/encrypted: tied to one provider. A pane that switches model must drop it. OpenAI needs the Responses API | Not now. Maybe later as an Anthropic-only optimisation |
| **G. Provider truncation** (OpenRouter middle-out, Ollama context shift) | Nothing shown | Free | Silent, cuts the middle where instructions often sit | Turn off (C0); replace with D/B, which we disclose |

### Prompt caching interactions

- Anthropic caches by exact prefix (tools → system → messages). Changing earlier messages misses the cache from
  that point. Writes cost 1.25× (5-minute TTL) or 2× (1 hour) the input price, and reads 0.1× (0.05× on Opus and
  Sonnet 5.5). Context editing "invalidates cached prompt prefixes", hence its `clear_at_least`
  ([prompt caching][a-cache], [context editing][a-edit]).
- OpenAI caches automatically from 1,024 tokens. The whole rendered prefix must match. Reads are discounted up
  to 95%, and on GPT-5.6+ writes cost more than plain input ([prompt caching][oa-cache]).
- **So: compact rarely and in big steps.** One compaction costs one summary call plus one cache write, then the
  shorter prefix caches again. A sliding window that moves every turn never hits the cache and can cost more than
  sending the full history. Strategy D should trim in chunks (e.g. drop the oldest 25% once), not slide.

### Which model writes the summary

- **Default: the pane's own model.** The key is already there, it understands the conversation, and there's no
  new setting. But it can't read a chat already past *its* window. So offer compaction from 80% (S4's
  "nearing"). When "over", summarise the oldest part that fits, then fold that summary into the rest (LibreChat
  does this with `updatePrompt`).
- **Optional "Summary model" setting**, built like the title model (`title-model.ts`): a cheaper or larger-context
  model. It must be a model the user has a key for. Show its cost in the confirmation.
- **Local models:** summarising on a small local model is slow and weak. Use the summary model if one is set,
  else offer D.
- **Workspaces:** each pane is its own chat, so compaction is per pane, against that pane's context length.
  Synced panes send the same prompt but their histories (replies) differ, so each pane keeps its own summary. A
  palette action "Compact all panes" can come later.

### Rules that apply

- **Hard rule 4:** analytics may record `context_compacted` with the trigger (manual/auto), the strategy and
  bucketed token counts. Never the summary or instructions. Error reports for a failed summary carry the
  provider, status and error name only, as `chatErrorLogFields` does now.
- **Hard rule 6:** the summariser takes a `resolveModel` like `BrowserChatTransport`. Unit tests use
  `MockLanguageModelV4` returning a fixed summary. e2e uses `e2e-mock-model`.
- **Hard rule 5:** the summary is model output. Render it with `SafeMarkdown`.
- **Data:** the summary is chat content saved in Dexie with the chat, included in exports, and synced with the
  chat once 6.1 exists. Slice B/A updates `docs/data-inventory.md` and the privacy policy's chat-content line.
- **Hard rule 8:** no composer changes. Actions live in the S4 notice, the pane menu and the palette.

## 4. Recommendation

1. **C0 first (tiny):** stop OpenRouter's silent middle-out on small endpoints, so our S4 ring and notice are
   the only behaviour.
2. **C1: New chat with summary**, from the S4 notice ("Continue in a new chat") and the palette.
3. **C2: Compact in place**, manual, keeping the last 4 turns verbatim, with a divider and a view-summary
   popover.
4. **C3: Auto-compact**, a Settings → Chat choice of *Off (default) / Ask at 80% / Automatic at 90%*.
5. Pins (E) and trimming (D) only if Yash wants them after using C1–C3.

## 5. Open questions for Yash

1. **Order:** new-chat-with-summary first (safest), or go straight to compact-in-place (what Claude.ai and
   Cursor do)?
2. **Auto-compaction default:** off (recommended; it spends your key without a click), "ask" at 80%, or
   automatic?
3. **Summary model:** the pane's own model by default plus an optional setting (recommended), or always a set
   cheap model?
4. Should the summary be editable before it takes effect (C2), or only viewable?
5. OK to turn off OpenRouter's automatic middle-out for ≤ 8K endpoints (C0)?

## 6. Proposed slices

- **C0 OpenRouter compression off.** Send `plugins: [{ id: "context-compression", enabled: false }]` on
  OpenRouter requests (in `routing-options.ts`). *Done when* a unit test shows the option on every OpenRouter
  request and none on other providers.
- **C1 Continue in a new chat with a summary.** A content-free summariser module (`src/lib/chat/summarise.ts`,
  model injected), a default prompt that keeps decisions, names, numbers, open questions and the latest request,
  and an action in the S4 notice and the palette that opens a new chat with the summary as an editable draft
  message and a link to the source chat. *Done when* the mock model's summary lands in a new chat's first
  message, the source chat is unchanged, a failed summary shows a readable error and changes nothing, and e2e
  covers the notice → new chat path.
- **C2 Compact in place.** A `compaction` marker (summary text, model, covered message ids, kept-turn count)
  saved as a message part on the branch path. The transport sends system + summary + messages after the marker.
  A divider with a view-summary popover (`SafeMarkdown`). S4 measures from the first reply after the marker.
  Exports carry it, and data-inventory/privacy wording is updated. *Done when* unit tests show the request after
  compaction holds only the summary plus kept turns, editing a message above the marker sends the full history
  again on the new branch, the ring drops after the next reply, and e2e covers compact → send → reload.
- **C3 Auto-compact setting.** Off / Ask at 80% / Automatic at 90% in Settings → Chat, a pre-send estimate
  (last usage + characters ÷ 4 for the new message and text files), a status line while it runs, and a stop
  after 2 failures in a row. *Done when* unit tests cover the three modes and the failure stop, and the
  `context_compacted` event passes the analytics allowlist test with no content fields.
- **C4 Summary model setting** (can merge into C1 if Yash wants). Same picker and storage pattern as the title
  model. *Done when* the summary call uses the chosen model, falls back to the pane's model when its key is
  missing, and the setting is in data-inventory.

### Follow-ups (outside R6)

- **F1:** a "trim in chunks" fallback (D) for local models, if wanted.
- **F2:** Anthropic direct gets no prompt caching now. Adding the top-level automatic `cache_control` would cut
  long-chat costs. It needs its own slice, since it changes the provider request.
- **F3:** Anthropic-native compaction as an optimisation for Anthropic panes, once C2 exists.

[a-overview]: https://platform.claude.com/docs/en/build-with-claude/compaction
[a-ondemand]: https://platform.claude.com/docs/en/build-with-claude/compaction-on-demand
[a-edit]: https://platform.claude.com/docs/en/build-with-claude/context-editing
[a-cache]: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
[cc]: https://code.claude.com/docs/en/how-claude-code-works
[claude-help]: https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans
[oa-compact]: https://developers.openai.com/api/docs/guides/compaction
[oa-state]: https://developers.openai.com/api/docs/guides/conversation-state
[oa-cache]: https://developers.openai.com/api/docs/guides/prompt-caching
[chatgpt-forum]: https://community.openai.com/t/chatgpts-context-limit-reached-problem/1417154
[cursor-16]: https://cursor.com/changelog/1-6
[cursor-blog]: https://cursor.com/blog/dynamic-context-discovery
[lc-sum]: https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/summarization
[lc-gauge]: https://github.com/danny-avila/LibreChat/pull/13744
[owui]: https://docs.openwebui.com/troubleshooting/context-window/
[lobe-tests]: https://github.com/lobehub/lobehub/blob/main/src/store/chat/helpers.test.ts
[lobe-20903]: https://github.com/lobehub/lobehub/issues/20903
[tm-params]: https://docs.typingmind.com/parameter-settings/parameter-settings
[tm-ctx]: https://docs.typingmind.com/manage-and-connect-ai-models/model-context-length
[or-mt]: https://openrouter.ai/docs/guides/features/message-transforms
[aisdk-prune]: https://ai-sdk.dev/docs/reference/ai-sdk-ui/prune-messages
