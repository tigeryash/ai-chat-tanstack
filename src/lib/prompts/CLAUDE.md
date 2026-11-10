# Prompt library

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.

- **Prompt library** (roadmap 3.6a, decision 19, `src/lib/prompts/`, UI in `src/components/prompts/`, page
  `/prompts`): saved prompts live in the chat database's `prompts` table (`prompt-store.ts`, their own format
  number in `prompt.ts`). Every save of new text appends a version; restore appends the old text again
  (`restoredFrom`), so history only grows (newest 200 kept). Name and tags aren't versioned. `diff.ts` is a line
  LCS for the history's diff view; `search.ts` matches name, tags and current text (`#tag` is exact).
- **Ownership**: prompts carry `ownerId` like chats. List them through `usePrompts()` (filters with
  `visibleChats` for the viewer); `chat-ownership.ts` moves or deletes them with the account's chats.
- **Apply** (`apply.ts`) copies a version's text into the chat's own `systemPrompt`, from the Model settings
  sheet (never the composer, hard rule 8). Prompt text is content: never log, track or put it in errors.
- **Model defaults** (roadmap 3.6b, `defaults.ts`): a prompt's optional `defaultFor` lists the model keys
  (`modelKey` in `lib/chat/chat-settings.ts`) it's the default for; `setModelDefault` keeps one per model
  among the viewer's prompts. Precedence (decision 19): the chat's own prompt → its model's default →
  the shared prompt (`resolveSystemPrompt`, used by `useChatParams`, so each pane resolves its own model).
  The default is a live link: edits apply to every chat without its own prompt; deleting the prompt
  falls back to the shared one. Set it in Model settings (`model-default-prompt.tsx`); the prompts page
  lists and removes them.
- **Provenance** (`provenance.ts`): a reply's metadata has `prompt: { promptId, version }` when its system
  prompt came from the library (a model default, or applied text not edited since, `systemPromptSource`
  on chat settings). The reply's "⋯" shows it and links to `/prompts?prompt=…&version=…`.
- **Exports**: `exportChats` / `importChats` take an optional `PromptStore`; prompts follow the chats' owner
  and newer-wins rules (`src/lib/storage/export.ts`).
- Not yet: variables (`{{date}}`).
