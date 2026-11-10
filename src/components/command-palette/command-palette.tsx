import { Dialog } from "@base-ui/react/dialog";
import { SearchIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics/track";
import {
	analyticsIdOf,
	type Command,
	type CommandEnv,
} from "@/lib/commands/command";
import { closeCommandPalette } from "@/lib/commands/palette-state";
import { rememberCommand, useRecentCommands } from "@/lib/commands/recent";
import { searchCommands } from "@/lib/commands/search";
import { logError } from "@/lib/log";
import { PaletteResults } from "./palette-results";
import { restoreSelection, returnElement, saveSelection } from "./return-focus";
import { useCommandEnv } from "./use-command-env";
import { usePaletteCommands } from "./use-palette-commands";

// The command palette (roadmap R2 S5, docs/settings-research.md section 3): a Base UI dialog with a
// combobox over a listbox, built by hand (shadcn's `command` needs cmdk, which pulls in Radix). Focus is
// trapped while it's open, and closing returns focus and the cursor to where they were (the composer).
// Under reduced motion it only fades (`data-fade-only` in src/styles.css).

type Pending = { command: Command; env: CommandEnv } | null;

function runCommand({ command, env }: NonNullable<Pending>) {
	rememberCommand(command);
	track("command_run", { id: analyticsIdOf(command) });
	try {
		void Promise.resolve(command.run(env)).catch((error: unknown) =>
			logError("A palette command failed:", error),
		);
	} catch (error) {
		logError("A palette command failed:", error);
	}
}

export function CommandPalette({ open }: { open: boolean }) {
	// A picked command runs once the palette has closed and focus is back, so whatever it opens (Settings)
	// returns focus there too.
	const pending = useRef<Pending>(null);
	const selection = useRef<ReturnType<typeof saveSelection>>(null);

	useEffect(() => {
		if (!open) return;
		selection.current = saveSelection();
		track("palette_opened", {});
	}, [open]);

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				if (!next) closeCommandPalette();
			}}
			onOpenChangeComplete={(isOpen) => {
				if (isOpen) return;
				restoreSelection(selection.current);
				selection.current = null;
				const picked = pending.current;
				pending.current = null;
				if (picked) runCommand(picked);
			}}
		>
			<Dialog.Portal>
				<Dialog.Backdrop
					data-fade-only
					className="fixed inset-0 z-50 bg-overlay/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"
				/>
				<Dialog.Popup
					data-fade-only
					data-testid="command-palette"
					finalFocus={() => returnElement() ?? true}
					className="fixed top-2 left-1/2 z-50 flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] -translate-x-1/2 flex-col overflow-hidden rounded-pane border bg-popover text-popover-foreground shadow-2xl outline-none transition-[opacity,scale] duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-[0.98] motion-safe:data-starting-style:scale-[0.98] sm:top-[12dvh] sm:max-h-[min(32rem,76dvh)] sm:w-[min(40rem,calc(100vw-4rem))]"
				>
					<Dialog.Title className="sr-only">Command palette</Dialog.Title>
					<PaletteBody
						onPick={(command, env) => {
							if (command.checked !== undefined) {
								runCommand({ command, env });
								return;
							}
							pending.current = { command, env };
							closeCommandPalette();
						}}
					/>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

/** The search box and its results. Mounted only while open, so every open starts empty. */
function PaletteBody({
	onPick,
}: {
	onPick: (command: Command, env: CommandEnv) => void;
}) {
	const [query, setQuery] = useState("");
	const [activeId, setActiveId] = useState<string | null>(null);
	const { commands, context, chatsFailed } = usePaletteCommands();
	const recent = useRecentCommands();
	const env = useCommandEnv();
	const listboxId = useId();
	const inputRef = useRef<HTMLInputElement>(null);

	const groups = searchCommands(commands, query, { context, recent });
	const flat = groups.flatMap((group) => group.commands);
	const activeIndex = Math.max(
		0,
		flat.findIndex((command) => command.id === activeId),
	);
	const active = flat[activeIndex];
	const optionId = (index: number) => `${listboxId}-option-${index}`;

	const move = (step: number) => {
		if (flat.length === 0) return;
		const next = (activeIndex + step + flat.length) % flat.length;
		setActiveId(flat[next]?.id ?? null);
	};

	return (
		<>
			<div className="flex items-center gap-2 border-b px-3">
				<SearchIcon
					aria-hidden
					className="size-4 shrink-0 text-muted-foreground"
				/>
				<input
					ref={inputRef}
					role="combobox"
					aria-expanded
					aria-controls={listboxId}
					aria-autocomplete="list"
					aria-activedescendant={active ? optionId(activeIndex) : undefined}
					aria-label="Search commands, chats and settings"
					placeholder="Search chats, settings and actions…"
					autoComplete="off"
					spellCheck={false}
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setActiveId(null);
					}}
					onKeyDown={(event) => {
						// The search box is the palette's one control, so Tab stays here (the focus trap).
						// Base UI's focus guards let Tab out of a dialog with a single tabbable field.
						if (event.key === "Tab") {
							event.preventDefault();
						} else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
							event.preventDefault();
							move(event.key === "ArrowDown" ? 1 : -1);
						} else if (event.key === "Enter" && active) {
							event.preventDefault();
							onPick(active, env);
						}
					}}
					className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
				/>
			</div>
			{chatsFailed && (
				<p role="alert" className="px-4 pt-2 text-destructive text-sm">
					Couldn't load your chats from this browser.
				</p>
			)}
			<PaletteResults
				listboxId={listboxId}
				groups={groups}
				query={query}
				activeIndex={activeIndex}
				optionId={optionId}
				onHover={(command) => setActiveId(command.id)}
				onPick={(command) => {
					inputRef.current?.focus();
					onPick(command, env);
				}}
			/>
			<p className="flex gap-3 border-t px-3 py-2 text-muted-foreground text-xs">
				<span>
					<kbd className="font-mono">&gt;</kbd> actions
				</span>
				<span>
					<kbd className="font-mono">#</kbd> chats
				</span>
				<span>
					<kbd className="font-mono">/</kbd> settings
				</span>
			</p>
		</>
	);
}
