# Settings and command palette research (Refine R2)

Research for roadmap R2 ("Settings design"): what Settings and a Cmd+K palette should hold, how other chat apps do
it, and a slice plan. Docs only; nothing here is built yet. Researched 2026-11-09.

## Summary

- **Use a full page with section nav, not a modal.** We'll have 12+ sections (keys, local servers, hosts,
  agents, MCP, voice, account), and keys and MCP forms need room. Every app with a modal (ChatGPT, Claude, Open
  WebUI) is getting complaints or a redesign as settings grow. LibreChat's 2026 redesign shows the way to copy:
  one **settings registry** that drives the nav, the search and the palette.
- **Group by job, in 11 sections** (12 once Phase 4 adds Agents). General, Models & hosts, Connections,
  Appearance, Chat, Prompts, Notifications, Keyboard, Your data, Privacy, Account, plus Agents (Phase 4). Voice
  goes under Chat, and sync and sharing go under Account. Each setting has a stated scope (global, per model, per
  workspace, per chat) and a stated storage (this device only, or syncs later). Keys are always this device only.
- **The Cmd+K palette does a lot of the work.** It handles navigation, actions (new chat, add pane, switch model,
  apply prompt, toggle sync, change theme), chat search and settings search, all fed by the same registry. It
  opens over the page and never touches the composer's look (hard rule 8). It loads on first use (bundle budget),
  and analytics record at most which command ran, never what you typed.
- **Theme presets are just saved appearance settings.** A preset is a 3.11 theme file shipped with the app, so it
  needs no new mechanism. Ship about 6: Default, High contrast, Brand (the landing page's magenta), Paper
  (warm, serif replies), and two popular open-licensed palettes. Add a few new token knobs too: corner radius,
  reading width, and the code-highlight theme.
- **Twelve small slices, in order** (S0–S11): prototypes first, then the shell and registry, then one slice per
  section, with the palette in two steps. My layout recommendation is **A: a full page with a left section nav
  and search**, with the palette giving quick access.

---

## 1. What other apps do

(unverified) means a third-party or unofficial source.

| App | Container and nav | Search in settings | Cmd+K | Theming |
|---|---|---|---|---|
| ChatGPT | Modal, left tabs | No | Chat search (web); command menu (desktop app) | Light/dark/system, preset accent |
| Claude.ai | Page, left tabs | No | Chat search (unverified) | Light/dark/system, 3 chat fonts |
| T3 Chat | Page, tabs (unverified) | No | (unverified) | Fonts, "boring theme" (unverified) |
| OpenRouter Chat | Account settings pages | No | Opens the model picker | — |
| LibreChat | Modal, 6 tabs | **Yes, from a registry** | None (requested) | Admin palette only |
| Open WebUI | One window, user and admin sections | Weak (complaint) | Chat search | UI scale, font |
| LM Studio | Separate window (Cmd+,) | No | Cmd+K, then T for themes | Themes, font scale |
| Msty Studio | Page, sections | — | **Full palette** (create, go to, settings, theme) | Mood, accent, base color, code theme |
| TypingMind | Modal, 3 tabs | No | Chat search | Light/dark, sidebar color, width, text size |
| Raycast | Window, sections | **Cmd+F searches settings** | It *is* a palette | Themes, interface size |

**ChatGPT.**
- **Settings:** a modal with left categories: General (appearance, contrast, accent color, language),
  Personalization (memory, custom instructions), Data controls (training opt-out, export, shared links, delete
  all), Speech, Account ([help](https://help.openai.com/en/articles/11958281-updating-your-visual-experience-on-chatgpt),
  [data controls](https://help.openai.com/en/articles/7730893-data-controls-in-chatgpt)).
- **Shortcuts:** Cmd+K searches chats on the web; the desktop app has a real command menu with rebindable keys
  ([help](https://help.openai.com/en/articles/10056348)). Cmd+/ lists shortcuts; Cmd+Shift+O starts a new chat.
- **Complaints:** search is exact-match only, a result opens at the end of the chat instead of at the match, and
  Ctrl+K goes to Chrome's address bar on Windows
  ([forum](https://community.openai.com/t/search-chatgpt-history-or-searchbar-for-chatgpt-chat-history/796896)).

**Claude.ai.**
- **Settings:** a page with sections: General / Appearance (color mode; chat font Default, System or Dyslexic
  friendly), Account, Privacy, Usage, Capabilities, Connectors
  ([help](https://support.claude.com/en/articles/8887527-customizing-your-appearance-settings)).
- **MCP:** custom MCP servers sit in their own **Connectors** section, next to capability toggles
  ([help](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities)). That
  model fits our Phase 4.
- **Complaints:** users ask for themes and accent colors
  ([issue](https://github.com/anthropics/claude-code/issues/55635)).

**T3 Chat.**
- **BYOK:** OpenRouter keys ([FAQ](https://t3.chat/faq)).
- **Settings (unverified; the page rate-limited):** tabs for Account, Customization (traits, fonts), History &
  Sync, Models, API Keys and Attachments.
- **Complaints:** users ask for more shortcuts: switch model, toggle the sidebar, open settings
  ([feedback](https://feedback.t3.chat/p/more-keyboard-shortcuts-please)).

**OpenRouter Chat.**
- **Cmd+K** opens "Add model", not a general palette
  ([docs](https://openrouter.ai/docs/cookbook/get-started/free-models-router-playground)).
- **Presets** bundle model, fallbacks, system prompt, sampling and provider rules; a "Default preset" applies to
  the chatroom ([docs](https://openrouter.ai/docs/guides/features/presets)).
- **Provider preferences are account settings.** Default sort, allowed and ignored providers, and data-collection
  policy (Settings → Preferences and Privacy) apply to "all API requests and chatroom messages" and merge with
  per-request `ignore`/`only` ([docs](https://openrouter.ai/docs/guides/routing/provider-selection)).
- **Request-only fields:** `max_price` and `quantizations` look like request or preset fields, not account
  settings (unverified). Our host preferences go further.

**Vercel AI Playground / v0.**
- **Playground:** panes side by side, a sync toggle per pane, a parameters dialog per model, drag to reorder, and
  share and code export ([launch post](https://x.com/vercel/status/1648451494440742917)). It's mostly what we
  already have; we couldn't see its current settings.
- **v0:** saved "Instructions" toggled from the prompt bar ([docs](https://v0.app/docs/instructions)), similar to
  our prompt library.

**LibreChat (most useful reference).**
- **The 2026 redesign** ([PR #13722](https://github.com/LibreChat-AI/LibreChat/pull/13722)): six tabs (General,
  Chat, Speech, Data & Privacy, Account, About) and **one settings registry** that feeds both the tabs and search.
  Search matches labels and keyword synonyms and shows the live control in the results.
- **Danger zone:** destructive actions moved from a hidden "Advanced" disclosure into an always-visible Danger
  zone.
- **Mobile:** the tabs become a drill-in list.
- **API keys** sit under Data & Privacy ([docs](https://www.librechat.ai/docs/features/settings)).
- **No Cmd+K yet:** users ask for one ([issue](https://github.com/danny-avila/LibreChat/issues/3664)).

**Open WebUI.**
- **Settings:** one window, with personal sections on top and admin sections below. Shortcuts are rebindable:
  Cmd+K search, Cmd+Shift+M model picker, Cmd+. settings, Cmd+/ shortcuts
  ([docs](https://docs.openwebui.com/features/chat-conversations/chat-features/keyboard-shortcuts/)).
- **Complaints (Oct 2026):** toggles sit far from their labels, user and admin settings get confused, and search
  is weak ([issue #32900](https://github.com/open-webui/open-webui/issues/32900)). This is the clearest warning
  against one long settings window.

**LM Studio.**
- **Settings:** Cmd+, opens it from anywhere ([0.3.3](https://lmstudio.ai/blog/lmstudio-v0.3.3)). One "Developer
  Mode" switch reveals advanced UI, replacing three user levels
  ([docs](https://lmstudio.ai/docs/app/user-interface/modes)).
- **Themes:** Cmd+K, then T, opens the theme picker ([docs](https://lmstudio.ai/docs/app/user-interface/themes)).
- **Asks and complaints:** users want a palette to find settings
  ([issue](https://github.com/lmstudio-ai/lmstudio-js/issues/568)), and text is too small with a broken font size
  setting ([issue](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/2571)).

**Msty Studio (best palette in this space).**
- **Settings sections:** Settings, Modes, Keyboard Shortcuts, Command Palette, Default Prompts, Remote
  Connections, Backups ([docs](https://docs.msty.ai/studio/settings/settings)).
- **Cmd+K (rebindable):** "create" (chat, split chat, workspace), "go to" (every area), open any settings
  section, and switch theme, accent and split width
  ([docs](https://docs.msty.ai/studio/settings/command-palette)).
- **Theming:** mood, accent and base color, font size, code theme, renderer toggles (Mermaid, math)
  ([2.6.0](https://msty.ai/blog/msty-studio-2-6-0-command-center)).

**TypingMind.**
- **Settings:** General, Appearance and Keyboard Shortcuts tabs.
- **Shortcuts (all rebindable):** Cmd+K search, Cmd+B sidebar, Cmd+Opt+N new chat, regenerate, copy the last
  message; "/" in the composer searches prompts ([docs](https://docs.typingmind.com/general-settings/keyboard-shortcuts)).
- **Appearance:** chat width and text size ([docs](https://docs.typingmind.com/general-settings/customize-app-appearance)).
- **Complaints:** sync costs extra, and it slows down with many chats
  ([reviews](https://setapp.com/apps/typingmind/customer-reviews)).

**Raycast AI.**
- **Settings:** Cmd+F searches settings ([manual](https://manual.raycast.com/settings)). Its AI section is close
  to ours: Default Models, API Keys (BYOK), Custom Providers (any OpenAI-compatible endpoint), Local Models,
  Agents, Tools (MCP), Personalization, Chat.
- **Chat shortcuts:** Cmd+Shift+M model, Cmd+Shift+U reasoning effort, Cmd+Shift+F search chats
  ([shortcuts](https://manual.raycast.com/keyboard-shortcuts)).

**Cmd+K patterns.**
- **Linear:** acts on the current selection, groups results by context, and "?" opens a searchable shortcut sheet
  ([docs](https://linear.app/docs/select-issues)).
- **Vercel:** jumps to projects, deployments and *settings pages*
  ([changelog](https://vercel.com/changelog/dashboard-universal-search)). Its guidance: once a flat list passes
  about 30 items, split it into pages ([Geist](https://vercel.com/geist/command-menu)).
- **GitHub:** prefixes (`>` commands, `#` issues, `@` people, `/` files), a scope chip, Cmd+Enter to open in a new
  tab ([docs](https://github.com/github/docs/blob/main/content/get-started/accessibility/github-command-palette.md)).
  Low usage nearly got it removed (unverified), and Ctrl+K clashes with the browser
  ([discussion](https://github.com/orgs/community/discussions/15255)).
- **VS Code:** `>` for commands, a "Category:" prefix on names, and never take over existing shortcuts
  ([guidelines](https://code.visualstudio.com/api/ux-guidelines/command-palette)).
- **cmdk:** filtering, keyword aliases and groups; nested pages are a README pattern (Esc or Backspace goes back)
  ([repo](https://github.com/pacocoursey/cmdk)). Its `Command.Dialog` and its dependencies are Radix, which we
  removed in 0.7. See section 3.

**What this means for us.**
1. A registry-driven settings page with search (LibreChat, Raycast) beats a modal that grows tabs (ChatGPT, Open
   WebUI).
2. A palette that only searches chats goes unused (GitHub). Msty's mix of create, go to, settings and theme is
   the one people use.
3. Power users want rebindable shortcuts and a shortcut sheet (T3 Chat, Open WebUI, TypingMind, GitHub).
4. Nobody in this space has good provider-routing preferences in a chat UI. OpenRouter keeps them in account
   settings. Ours can be a standout feature.

---

## 2. Information architecture

### Container

Settings stays a route inside the dashboard shell, with the app sidebar still visible:

- **Sections:** `/settings/<section>`, with a left section nav and a search box at the top of the nav.
- **Narrow screens:** below `md` the nav becomes a list, and each section opens as its own screen (LibreChat's
  drill-in).
- **Old links keep working:** `/settings` opens General, and the OpenRouter OAuth callback still lands on
  `/settings` (or moves to `/settings/connections` with a redirect). Old `#provider-keys`-style anchors redirect
  to their section.
- **One registry:** a settings registry (`src/lib/settings/registry.ts`) lists every section and setting (id,
  label, keywords, section, scope, `phase` gate). The nav, the in-page search and the palette all read it, so a
  later phase adds a setting by adding a registry entry and a control, never by redesigning the page.

### Sections

Legend: **(new)** = doesn't exist yet. **(move)** = exists today, moves here unchanged. *Scope*: G = global (this
browser), M = per model, W = per workspace, C = per chat or pane. *Storage*: **D** = this device only, forever.
**S** = this device now, syncs in Phase 6.

| # | Section | Contents | Scope | Storage |
|---|---|---|---|---|
| 1 | **General** | Default model for new chats **(new**; today it's "last picked", which stays as an option) · Number of panes in a new chat, or a saved layout to start from **(new)** · Title model, the "utility model" that names chats (1.4 follow-up) **(new)** · Open Settings with Cmd+, (see Keyboard) | G | S |
| 2 | **Models & hosts** | The picker's "Run with" switches **(move**, still in the picker too): Hide unavailable, Only hosts that don't train, what Auto optimizes · Host blocklist **(new)** · Price cap for Auto **(new)** · Exclude quantized hosts **(new)** · Context-length warnings on/off **(new)** · Picker opens on High Elo or All **(new)** · Per-model defaults: params and default prompt, a list with "edit" for each model that has one **(new** view over what 2.4b and 3.6b already store) | G; per-model defaults M | S |
| 3 | **Connections** | API keys and Connect OpenRouter **(move)** · Local model servers **(move)** · AI Gateway key (already a provider) · Later: search-tool API key (4.2), keys kept for durable agent runs with delete (decision 25), other OpenAI-compatible endpoints (business edition) | G | **D** (keys never sync; endpoint *names* could) |
| 4 | **Appearance** | Theme, fonts, text size, density, accent, advanced colors, theme file, Reset all **(move)** · Presets **(new)** · Corner radius, reading width, code-highlight theme **(new)**. See section 4 | G | S |
| 5 | **Chat** | Reply stats shown inline: none, cost, or all (2.5b follow-up) **(new)** · Reasoning starts open or closed **(new)** · Sync scroll on by default (3.4) **(new)** · New panes start synced **(new)** · Later: **Voice** (Phase 5) — dictation engine (hosted with which key, or on-device Moonshine), language, voice-mode voice, push-to-talk key | G | S |
| 6 | **Prompts** | Shared default system prompt **(new** home; today it's set per chat) · Link to the library at `/prompts` (the library stays its own page) · Later: prompt variables (`{{date}}`) | G | S |
| 7 | **Notifications** | Today's "Background status" **(move**, renamed): tab title and favicon status, a browser notification per event type, a test notification · Later: "agent finished" and "approval needed" events (Phase 4) | G | D (the permission belongs to the browser) |
| 8 | **Keyboard** | Shortcut list **(new)** · Rebinding **(new, later)** · An "Enable single-key shortcuts" switch (on by default) for screen-reader users **(new)** | G | S |
| 9 | **Your data** | Export / import **(move)** · Persistent storage status (decision 9) **(new** home) · Storage used: chats, attachments **(new)** · Danger zone: delete all chats on this device **(new)** · Later: workspaces and layouts in exports (R4) | G | D |
| 10 | **Privacy** | Analytics and error-report opt-out **(move)**, with a plain-words line that analytics never see content · Links to Privacy Policy and Terms **(move** from the footer) · Later: share links list and "include system prompt" default (6.3) | G | S |
| 11 | **Account** | Signed out: "Sign in to sync and share". Signed in **(new)**: name, email, avatar, linked sign-in methods, sign out and "sign out and remove my chats" (1.9) · Later: sync on/off and status (6.1), sessions, passkeys and 2FA (6.4), plan (6.5), delete account (7.2) | account | server (Convex) |
| 12 | **Agents** (hidden until Phase 4) | Permission mode, from "ask every time" to YOLO (decision 26), and per-tool overrides (4.3) · Tools on/off (4.2) · **MCP servers**: add, pin tool definitions, flag changes (4.4) · **Skills** (4.5) · Subagent depth, count and cost limits (4.6) · Durable runs: runtime and kept-key list (4.1, decision 25; the keys themselves live under Connections) · Hooks (4.9) | G, overridable per chat | S, except anything holding a key: D |

As Agents grows past about 6 groups it becomes a nav group with child pages (Agents → Permissions, MCP servers,
Skills), the way Claude.ai splits off Connectors. The registry's `section` field takes a path, so this needs no
redesign. **About** (version, changelog, licenses) can go at the bottom of the nav whenever there's something to
put there.

### Scope rules

Write these into the registry, and show the scope next to the control ("Applies to every new chat in this
browser").

- **Global** (Settings): everything in the table unless marked otherwise.
- **Per model:** param defaults and default system prompt, set from Model settings or from Models & hosts.
- **Per workspace:** layout, panes and their order, sync state (3.5). Saved layouts are named templates. The
  "panes in a new chat" default under General points at one.
- **Per chat or pane:** the model and host (including the Auto switch, `ModelChoice.autoHost`), param overrides,
  system prompt override, and the attachments decision (3.3).
- **Precedence:** pane → chat → model default → global, the same order as decision 19 for prompts. A host
  blocklist is the exception: it's **global and absolute**. A pinned host that's blocked shows "blocked in
  Settings" in "Run with" instead of silently switching.
- **Sync (Phase 6):** "S" settings sync as one versioned settings document per account. Keys, local endpoint
  URLs, notification permission and storage facts never sync.

### Host preferences detail (2.2b sub-items)

| Setting | Maps to | Notes |
|---|---|---|
| Blocklist | OpenRouter `provider.ignore`; Gateway's host filter; direct-key hosts hidden in "Run with" | One list across routers, named by host ("DeepInfra"), not by router |
| Price cap for Auto | OpenRouter `provider.max_price` `{prompt, completion}` per million tokens; our own filter for Gateway and direct hosts | Only Auto respects it. A pinned host above the cap gets a badge but still runs |
| Exclude quantized | OpenRouter `provider.quantizations` (an allowlist, e.g. `fp16`, `bf16`, `fp8`), Gateway `!quantization:` | Offer a minimum ("fp8 or better") instead of a checkbox per format |
| Context-length warnings | Compare the chat's token count with the host's context | Show in the pane header, outside the composer (hard rule 8) |

OpenRouter docs for all of these: [provider selection](https://openrouter.ai/docs/guides/routing/provider-selection).
Users who set the same lists in their OpenRouter account get both lists merged by OpenRouter, so we only add to
theirs.

---

## 3. Command palette

### Scope (v1, then v2)

**v1:**
- **Go to:** a chat by title, recent chats first. Uses `ChatStore` through the viewer from `ownership.ts`, so
  another account's chats never appear (storage rule).
- **Go to:** a workspace or saved layout, the Prompts page, any Settings section.
- **Create:** a new chat, a new chat from a saved layout.
- **Settings search:** registry entries. Picking one opens the section with that control focused and highlighted.
  Simple toggles (theme light/dark/system, density, analytics) can flip right in the palette, like Msty.

**v2 (acts on the focused pane):**
- Add pane, remove pane, toggle sync, switch model (opens the existing picker for that pane), switch host.
- Apply a saved prompt as the system prompt for this pane or all synced panes, open model settings, copy the last
  reply, regenerate, stop all.
- Switch theme or preset.

**Later:** searching message text (local, Dexie). Agent commands: run a skill, open MCP servers.

### Behavior

- **Prefixes (GitHub-style):** `>` actions only, `#` chats only, `/` settings only. With no prefix, mixed results
  in this group order: actions for the current context, chats, settings.
- **Recency:** recently run commands float up, and the list is stored in this browser.
- **Nested pages:** commands that need input push a page. "Switch model" → model list; Backspace on an empty
  query or Esc goes back. This is cmdk's README pattern.
- **Every command:** a registry entry with id, title, keywords, group, shortcut, `when` (the context it needs,
  such as "focused pane") and `run`. The Keyboard section and the `?` sheet read the same list, so a shortcut is
  never documented in two places.
- **Lazy loading:** the Cmd+K listener sits in the dashboard shell, and the dialog and its search are imported
  with `import()` on first open. Chat search reads Dexie, which only chat routes may load (bundle budget), so it
  loads with the dialog.
- **Library:** cmdk pulls in Radix (removed in 0.7), so build on Base UI. Use a Base UI `Dialog` with Base UI's
  `Autocomplete`/`Combobox` list, or a small hand-rolled list with `aria-activedescendant`. Check what the
  `base-vega` shadcn `command` component depends on before choosing.
- **Accessibility:** combobox and listbox roles, focus trapped while open, focus goes back to where it was on
  close. Reduced motion: the open animation is only a fade.
- **Analytics (hard rule 4):** at most `palette_opened` and `command_run {id}` through `track()`. Never the
  query, never a chat title.

### How it relates to the composer (hard rule 8)

- **Outside the composer:** the palette is a dialog over the whole page, so it changes nothing about the
  composer's look.
- **Works while typing:** Cmd+K must work with focus in the composer's textarea. Listen on `window` in the capture
  phase, and when the palette closes, return focus (and the cursor position) to the composer.
- **Commands that change content:** "Apply prompt" sets the pane's system prompt, which the composer doesn't show.
  A later "Insert prompt text" would only change the textarea's *content*, which is invisible wiring, so it's
  allowed.
- **Needs a mockup first:** no "⌘K" hint, slash menu or popover *inside* the composer without Yash's approval of a
  mockup. Put the hint in the sidebar's search row or the chat header instead. A "/" slash menu (TypingMind) would
  sit on the composer, so it would need its own mockup.

### Shortcuts

Show ⌘ on Mac and Ctrl elsewhere. Avoid keys browsers reserve (Cmd+N, Cmd+T, Cmd+W, Cmd+L, Cmd+R, Cmd+1–9,
Cmd+F), DevTools keys (Cmd+Shift+C / I / J), and Firefox's Ctrl+Shift+S (screenshot) and Ctrl+Shift+P (private
window).

| Shortcut | Action | Precedent |
|---|---|---|
| ⌘K | Command palette (also opens from a sidebar button) | Linear, Vercel, Msty |
| ⌘⇧O | New chat | ChatGPT |
| ⌘B | Toggle sidebar (exists) | TypingMind, shadcn |
| ⌘, | Settings | LM Studio, macOS convention |
| ⌘/ | Shortcut sheet | ChatGPT, Claude, Open WebUI |
| ⌘⇧M | Switch model in the focused pane | Open WebUI, Raycast |
| ⌘\ | Add pane (to the right of the focused one) | VS Code split |
| ⌘⇧\ | Remove the focused pane | — |
| Ctrl+1–4 (Mac) / Alt+1–4 (Windows, Linux) | Focus pane 1–4 | Test in each browser first |
| ⇧Esc | Focus the composer | ChatGPT (unverified) |
| ? (outside text fields) | Shortcut sheet | Linear, GitHub |

Destructive actions (delete a chat, delete all) stay in the palette with a confirm and get no default shortcut.
Rebinding comes after v1 and is stored with the Keyboard settings.

---

## 4. Theming beyond 3.11

**Presets** (the open 3.11 item). A preset is a theme file the app ships (`exportSchema` from
`src/lib/appearance/schema.ts`): picking one writes those settings, and editing after that makes it "Custom
(from Paper)".
- **Picking:** presets show as a grid of small preview cards (the real tokens on a mini pane), with a live
  preview on hover or focus. They work from the palette too ("Theme: Paper").
- **Testing:** a unit test runs each preset through `contrast.ts` (AA in both modes).

| Preset | Idea |
|---|---|
| Default | Today's direction A |
| High contrast | Pure black and white, thicker lines, AAA text. Pairs with Atkinson Hyperlegible |
| Brand | Direction B's magenta accent and glow-free cards, so the app matches the landing page |
| Paper | Warm off-white, sepia lines, Source Serif replies, comfortable density: for long reading |
| Nord-style / Dracula-style | Popular MIT-licensed palettes, credited, mapped onto our tokens |

**New knobs** (each is one more token override):
- **Corner radius:** sharp, default, round. Overrides `--radius` and `rounded-pane`.
- **Reading width:** the max line length of replies, narrow / default / full. TypingMind's "chat width".
- **Code-highlight theme:** follows the theme by default, or a picked Shiki theme, through Streamdown's code
  theme option.
- **Pane accent per model** (optional): a thin colored top border per pane, to tell models apart when comparing.
  Off by default.

**Stays out:**
- **Custom CSS:** XSS risk on a page that holds keys (security.md). TypingMind keeps it to its team edition.
- **Theming the composer:** hard rule 8.
- **A theme store or sharing service:** theme files already cover sharing.

---

## 5. Slices for R2 (in order)

Each slice is one PR; S2 onward can run in parallel once S1 lands.

- [ ] **S0 Layout prototypes.** Three throwaway layouts under `/e2e/settings-proto/` (as in 3.0) on fixture data
  with the real section list, each with the palette open in one screenshot. *Done when:* Yash picks one;
  screenshots go into this doc.
- [ ] **S1 Settings shell and registry.** `/settings/$section` with the chosen nav, in-page search over the
  registry, mobile drill-in, and every existing control moved unchanged into its section. Old `/settings` links
  and the OpenRouter OAuth callback still work. *Done when:* Vitest covers registry search (labels and keywords),
  and e2e reaches every existing control by nav and by search. The keys, local endpoints, appearance and export
  e2e specs pass unchanged apart from navigation.
- [ ] **S2 General: default model and title model.** "Default model for new chats" (last used or a fixed model)
  and "Title model" (off = first line, as today). Titles are written once, with the user's key, never logged.
  *Done when:* Vitest covers default resolution and title fallback; e2e on a mock model gets an auto-title and a
  fixed default model in a new chat after reload.
- [ ] **S3 Host preferences.** Blocklist, exclude quantized, price cap for Auto in Models & hosts, mapped to
  OpenRouter and Gateway routing. *Done when:* Vitest covers the mapping and Auto's filtering; e2e on fixture
  endpoints shows a blocked host gone from Auto and marked in "Run with", and the request to the faked OpenRouter
  carries `ignore`, `quantizations` and `max_price`.
- [ ] **S4 Context-length warnings.** A pane-header notice when the chat outgrows its host's context, with a
  switch in Settings. *Done when:* Vitest covers the check; e2e shows the notice on a fixture chat and not when
  it's off.
- [ ] **S5 Palette v1.** Cmd+K, go to (chats, workspaces, settings sections, Prompts), new chat, settings search,
  quick toggles, recency, lazy-loaded. *Done when:* e2e opens it from the composer and returns focus there, finds
  a chat and a setting, and opens neither another account's chat nor any request; the bundle budget passes; the
  reduced-motion spec covers it.
- [ ] **S6 Keyboard section and shortcut sheet.** Shortcut list from the command registry, ⌘/ and ? sheet, the
  shortcuts in the table above. *Done when:* e2e runs each shortcut once on macOS and Linux keymaps and none fires
  while typing in a field (except Cmd+K and ⇧Esc).
- [ ] **S7 Palette v2.** Pane actions: add or remove pane, toggle sync, switch model or host, apply prompt, copy
  last reply, regenerate, stop all, theme switch. *Done when:* e2e does each on a two-pane mock workspace, and the
  composer screenshot baselines are unchanged.
- [ ] **S8 Account section.** The signed-in profile, linked methods, both sign-out paths; signed out shows the
  sign-in card. Rows for 6.x appear as those slices land. *Done when:* e2e with the stubbed session covers both
  states.
- [ ] **S9 Theme presets and new knobs.** Presets grid with preview, radius, reading width, code theme.
  *Done when:* Vitest checks each preset passes AA in both modes; e2e applies one, reloads with no flash, and
  edits it into "Custom".
- [ ] **S10 Chat section.** Inline reply stats (the 2.5b leftover), reasoning open or closed, sync-scroll and
  new-pane-synced defaults. *Done when:* e2e covers each default on a new chat.
- [ ] **S11 Your data and Privacy tidy-up.** Storage used, persistence status, Danger zone, legal links.
  *Done when:* e2e shows the storage numbers on a fixture chat and the delete-all confirm.

**Data and legal:** S2 (title model sends the first message to the user's own provider; nothing new to us), S3
and S6 store new local settings: update `docs/data-inventory.md` in each. S8 shows account data already
collected. No slice sends anything new to our servers.

### Layout options for S0

**A. Full page with left section nav (recommended).**
- **Layout:** Settings is a page in the dashboard shell. A narrow left column lists the 11 sections (grouped:
  *App* — General, Appearance, Chat, Keyboard, Notifications; *Models* — Models & hosts, Connections, Prompts;
  *You* — Your data, Privacy, Account) with a search box on top. The right side holds one section at a time,
  max-width as today.
- **Mobile:** list → detail.
- **Precedent:** Vercel, GitHub, Linear, Raycast, Claude.ai.
- **Why:** deep links, room for key and MCP forms, and it scales to Agents' child pages.
- **Cost:** you leave the chat to change something. The palette covers that.

**B. Modal with left tabs.**
- **Layout:** Cmd+, opens a large dialog over the current chat, with tabs on the left (ChatGPT, LibreChat). Deep
  link through `?settings=appearance`.
- **Why:** quick tweaks while looking at the chat, and theme changes are visible right away behind the dialog.
- **Cost:** gets cramped with 12+ sections, nested Agents pages and long forms (Open WebUI's complaints), plus
  focus-trap and scroll-in-dialog work on mobile.

**C. One long page with a sticky table of contents.**
- **Layout:** today's page, plus a sticky in-page TOC on the left with scroll-spy and a filter box that hides
  non-matching sections.
- **Why:** the smallest change, and Ctrl+F still works across everything.
- **Cost:** the page is already long and will double, and there are no per-section URLs (anchors only).

Recommendation: **A**. B's one advantage (seeing a change take effect behind the dialog) is covered by
Appearance's live previews and the palette's quick toggles.
