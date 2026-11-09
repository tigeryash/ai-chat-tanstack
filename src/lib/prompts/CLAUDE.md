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
- Not yet (3.6b): per-model defaults and which prompt version produced a reply; prompts in exports.
