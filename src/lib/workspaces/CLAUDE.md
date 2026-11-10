# Workspaces

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.

- **Workspaces** (roadmaps 3.1–3.2 and 3.5, `src/lib/workspaces/`, `src/components/workspaces/`): `/w/$workspaceId` shows
  1–4 panes, each a `ChatScreen` on its own chat, in `react-resizable-panels`. The record (pane chat ids, widths,
  synced) is the ChatStore's `workspaces` table (`storage/workspace.ts`, its own format version). `pane-sync.ts`
  is the hub synced panes join: one shared draft (the composer's optional `value`/`onValueChange`), send to all,
  Stop all, and the "Diverged" check. Panes hold their own model choice (`holdChatModelChoice`), or a pick in one
  would move the others. Attachments are checked per pane (roadmap 3.3, decision 17): synced composers share
  the hub's one `AttachmentList` (`hub.attachments`, `lib/attachments/attachment-list.ts`), so they all show the
  same chips and a send from any of them sends and clears the same files. Each pane whose model can't read one
  gets an amber border and inward glow (`useCantReadAttachments`; outer glows are clipped by the resizable panels), a warning icon on its phone tab (the hub's `warned`, set by each pane) and `PaneAttachmentNotice` (a radio group: send text only, or
  skip the pane, held until the send), and `sendAll` gives each pane only what its model reads
  (`lib/attachments/capability.ts`; only images and PDFs depend on the model). The sidebar folds a workspace's chats into one entry (`sidebar-entries.ts`).
- **Ownership** (roadmap 1.9, quality audit Q2 W2–W4): a new pane's chat (and the workspace "Add pane" makes) is
  the viewer's. Panes of another account's chats are hidden, not dropped: `openWorkspace` returns them as
  `hiddenPanes` and every save puts them back (`withHiddenPanes`). Delete workspaces and their chats only through
  `workspace-cleanup.ts` (`deleteWorkspaceAs`, `dropDeletedPanes`), never from a pane list the viewer sees.
  Workspaces follow their chats on the sign-in question and on "remove my chats" (`chat-ownership.ts`).
- **Layouts and links** (roadmap 3.5): `/new?models=a,b,c` (`model-link.ts`, parsed in `validateSearch`, so it
  imports only Zod) opens a workspace with a fresh chat per catalog model (`createWorkspaceWith`); unknown ids are
  dropped and counted in `/w/$id?missing=n`. Saved layouts (`saved-layouts.ts`, localStorage) keep pane models,
  widths and sync, never chat ids; opening one makes a new workspace. Both travel in exports (`workspace-transfer.ts`, Refine R4): a
  workspace keeps only panes whose chat is in the file, and an import puts back the panes here the viewer can't see. Neither changes the default for new chats
  (`setChatModelChoice`, not `storeChatModelChoice`).
- **Compare tools** (roadmap 3.4): each pane's stats line (`pane-stats.ts`, latest reply's TTFT and tok/s plus the
  chat's cost, built on `readReplyStats` / `chatUsage`) sits under its header, never on replies. Sync scroll
  (`sync-scroll.ts`) matches panes by scroll proportion, for this visit only. "Copy settings to all panes"
  (`copy-settings.ts`) copies params and system prompt, never the model. Votes are `lib/chat/chat-votes.ts`.
