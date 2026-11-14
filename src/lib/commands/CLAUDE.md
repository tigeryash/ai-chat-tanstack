# Commands and the command palette

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.

- **Command registry** (roadmap R2 S5, docs/settings-research.md section 3): a `Command` (`command.ts`) is id,
  title, keywords, group, shortcut, `when` and `run(env)`. No React here: commands act through `CommandEnv`, which
  the palette implements (`src/components/command-palette/use-command-env.ts`). The shortcut sheet (S6) and pane
  actions (S7) reuse this list, so a shortcut is written down once. Fixed commands are in `app-commands.ts`;
  chats, workspaces, layouts and Settings rows are made in `data-commands.ts`.
- **Hard rule 4:** a command made from your data (chat, workspace, layout) sets `kind`. Analytics send
  `kind ?? id` (`command_run`), and only commands without a `kind` go into the recent list (`recent.ts`,
  localStorage `highelo-recent-commands`). Never put a chat id or title in a fixed id.
- **Chats only through the viewer:** the palette lists `sidebarEntries(chats, workspaces, viewer)`, as the
  sidebar does (src/lib/storage/CLAUDE.md).
- **Bundle budget:** only `palette-state.ts` and `shortcut.ts` (and the host and button in
  `src/components/command-palette/`) are in the dashboard shell. Everything
  else loads with the palette through `import()`. Keep those two files small.
- Toggles (`checked` set) run without closing the palette. Other commands run once it has closed and focus
  is back where it was, so what they open (Settings) returns focus there too.
- **Pane actions** (R2 S7, `pane-commands.ts`): commands on the focused pane, which
  `src/lib/workspaces/focused-pane.ts` tracks (the last pane clicked or focused, else pane 1). Each chat screen
  registers its controls there (`src/components/chat/use-pane-controls.ts`), built from the functions its own
  buttons call; a command's `when` reads `context.pane` and its `run` reads `focusedPane()` when it runs, so a
  shortcut (S6) can run the same command. Ids for shortcuts: `PANE_COMMAND_IDS`.
- **Nested pages:** a command with `opens` pushes a page (switch model, switch host, apply prompt, switch theme)
  instead of running. Its rows are built only while it shows (`searchPage`), Backspace on an empty query or Esc
  goes back. Rows from the catalog or your prompts set a `kind` (`pane.model`, `pane.host`, `prompt.apply`).
