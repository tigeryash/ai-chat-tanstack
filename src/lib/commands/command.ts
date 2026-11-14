import type { SettingId } from "@/lib/settings/registry";
import type { SettingsSectionId } from "@/lib/settings/section-ids";
import type { PaneControls } from "@/lib/workspaces/focused-pane";
import type { LayoutPane } from "@/lib/workspaces/saved-layouts";

// The command registry's shape (roadmap R2 S5, docs/settings-research.md section 3). The palette lists
// commands; the shortcut sheet (S6) and pane actions (S7) read the same list, so a shortcut is never
// written down twice. No React here: a command says what it does through `CommandEnv`, which the UI
// that runs it provides.

/** Where a command is listed. Prefixes pick one: `>` actions, `#` chats, `/` settings. */
export type CommandGroup = "actions" | "chats" | "settings";

/** Keys as named in a shortcut: "Mod" is ⌘ on a Mac and Ctrl elsewhere. */
export type ShortcutKey = "Mod" | "Shift" | "Alt" | (string & {});
export type Shortcut = readonly ShortcutKey[];

/** What a command's `when` can look at. */
export interface CommandContext {
	pathname: string;
	/** The pane pane actions act on (R2 S7, `lib/workspaces/focused-pane.ts`); undefined with no chat on screen. */
	pane?: PaneControls;
}

/**
 * A nested page (docs/settings-research.md "Behavior"): picking its command lists these instead, with
 * its own search. Backspace on an empty query or Esc goes back.
 */
export interface CommandPage {
	/** Shown before the search box, and as the results' label. */
	title: string;
	placeholder: string;
	/** Built when the page shows, so a long list (the models) costs nothing until then. */
	commands: () => Command[];
	/** Said when the page has nothing to list. */
	empty: string;
}

/** What a command can do. The palette implements it with the router and the app's stores. */
export interface CommandEnv {
	goTo(path: "/new" | "/prompts"): Promise<void>;
	openChat(chatId: string): Promise<void>;
	openWorkspace(workspaceId: string): Promise<void>;
	/** A new workspace with fresh chats, from a saved layout's panes. */
	openLayout(panes: readonly LayoutPane[]): Promise<void>;
	/** Opens Settings at `section`; with `setting`, focuses and highlights that row. */
	openSettings(section: SettingsSectionId, setting?: SettingId): void;
	toggleSidebar(): void;
}

export interface Command {
	/** Unique in the list. For a fixed command it's also what recency stores and analytics send. */
	id: string;
	/**
	 * Set on commands made from your data (a chat, a workspace, a layout): a slug naming the kind, sent
	 * to analytics instead of `id`, and never remembered as recent. A chat's id or title never leaves.
	 */
	kind?: string;
	title: string;
	/** A quiet second line: the Settings section a row sits in, a workspace's pane count. */
	detail?: string;
	/** Other words people search for. Titles are searched too. */
	keywords: readonly string[];
	group: CommandGroup;
	shortcut?: Shortcut;
	/** Listed only when this is true. */
	when?: (context: CommandContext) => boolean;
	/** For a toggle: whether it's on now. A toggle runs without closing the palette. */
	checked?: boolean;
	/** Listed only for a search (or its group's prefix), not in the opening list. */
	searchOnly?: boolean;
	/** Opens a nested page instead of running; `run` is then not called. */
	opens?: CommandPage;
	run(env: CommandEnv): void | Promise<void>;
}

/** What analytics may send for a command: its kind for one made from your data, else its fixed id. */
export function analyticsIdOf(command: Command): string {
	return command.kind ?? command.id;
}

/** Fixed commands are remembered as recent; ones made from your data aren't. */
export function isRememberable(command: Command): boolean {
	return command.kind === undefined;
}
