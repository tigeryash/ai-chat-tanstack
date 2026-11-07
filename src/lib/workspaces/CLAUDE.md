# Workspaces

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.
- **Workspaces** (roadmaps 3.1–3.2, `src/lib/workspaces/`, `src/components/workspaces/`): `/w/$workspaceId` shows
  1–4 panes, each a `ChatScreen` on its own chat, in `react-resizable-panels`. The record (pane chat ids, widths,
  synced) is the ChatStore's `workspaces` table (`storage/workspace.ts`, its own format version). `pane-sync.ts`
  is the hub synced panes join: one shared draft (the composer's optional `value`/`onValueChange`), send to all,
  Stop all, and the "Diverged" check. Panes hold their own model choice (`holdChatModelChoice`), or a pick in one
  would move the others. The sidebar folds a workspace's chats into one entry (`sidebar-entries.ts`).
- **Ownership** (roadmap 1.9, quality audit Q2 W2–W4): a new pane's chat (and the workspace "Add pane" makes) is
  the viewer's. Panes of another account's chats are hidden, not dropped: `openWorkspace` returns them as
  `hiddenPanes` and every save puts them back (`withHiddenPanes`). Delete workspaces and their chats only through
  `workspace-cleanup.ts` (`deleteWorkspaceAs`, `dropDeletedPanes`), never from a pane list the viewer sees.
  Workspaces follow their chats on the sign-in question and on "remove my chats" (`chat-ownership.ts`).
