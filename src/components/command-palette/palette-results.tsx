import {
	CheckIcon,
	CornerDownLeftIcon,
	LayoutGridIcon,
	type LucideIcon,
	MessageSquareIcon,
	SettingsIcon,
	ZapIcon,
} from "lucide-react";
import { useEffect } from "react";
import type { Command, CommandGroup } from "@/lib/commands/command";
import type { ResultGroup } from "@/lib/commands/search";
import { shortcutKeys, shortcutLabel } from "@/lib/commands/shortcut";
import { cn } from "@/lib/utils";

const GROUP_ICONS: Record<CommandGroup, LucideIcon> = {
	actions: ZapIcon,
	chats: MessageSquareIcon,
	settings: SettingsIcon,
};

function iconFor(command: Command): LucideIcon {
	if (command.kind === "workspace.open") return LayoutGridIcon;
	return GROUP_ICONS[command.group];
}

interface PaletteResultsProps {
	listboxId: string;
	groups: ResultGroup[];
	query: string;
	activeIndex: number;
	optionId: (index: number) => string;
	onHover: (command: Command) => void;
	onPick: (command: Command) => void;
}

/** The palette's listbox: grouped options, one of them active (`aria-activedescendant` on the input). */
export function PaletteResults({
	listboxId,
	groups,
	query,
	activeIndex,
	optionId,
	onHover,
	onPick,
}: PaletteResultsProps) {
	const activeOptionId = optionId(activeIndex);

	// Keeps the active option in view as the arrow keys move it.
	useEffect(() => {
		document
			.getElementById(activeOptionId)
			?.scrollIntoView({ block: "nearest" });
	}, [activeOptionId]);

	let index = 0;
	return (
		// Out of the tab order: Chrome makes a scroll box focusable, which breaks the dialog's focus trap,
		// and the arrow keys already move through the results from the search box.
		<div
			tabIndex={-1}
			className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 outline-none"
		>
			<p
				role="status"
				className={cn(
					"px-2 py-6 text-center text-muted-foreground text-sm",
					groups.length > 0 && "sr-only",
				)}
			>
				{groups.length > 0
					? ""
					: query.trim()
						? `Nothing matches “${query.trim()}”.`
						: "Nothing here yet."}
			</p>
			<div id={listboxId} role="listbox" aria-label="Results">
				{groups.map((group) => {
					const labelId = `${listboxId}-${group.id}`;
					return (
						// biome-ignore lint/a11y/useSemanticElements: a listbox's option groups are role="group", not fieldsets
						<div
							key={group.id}
							role="group"
							aria-labelledby={labelId}
							className="pb-1"
						>
							<p
								id={labelId}
								className="px-2 pt-2 pb-1 font-medium text-muted-foreground text-xs"
							>
								{group.label}
							</p>
							{group.commands.map((command) => {
								const current = index++;
								return (
									<PaletteOption
										key={command.id}
										id={optionId(current)}
										command={command}
										active={current === activeIndex}
										onHover={() => onHover(command)}
										onPick={() => onPick(command)}
									/>
								);
							})}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function PaletteOption({
	id,
	command,
	active,
	onHover,
	onPick,
}: {
	id: string;
	command: Command;
	active: boolean;
	onHover: () => void;
	onPick: () => void;
}) {
	const Icon = iconFor(command);
	const toggle = command.checked !== undefined;
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: keys reach options through the combobox (aria-activedescendant)
		<div
			id={id}
			role="option"
			aria-selected={active}
			aria-checked={toggle ? command.checked : undefined}
			tabIndex={-1}
			onMouseMove={onHover}
			// Keeps focus in the search box.
			onMouseDown={(event) => event.preventDefault()}
			onClick={onPick}
			className={cn(
				"flex cursor-default select-none items-center gap-3 rounded-md px-2 py-2 text-sm",
				active && "bg-accent text-accent-foreground",
			)}
		>
			<Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
			<span className="grid min-w-0 flex-1">
				<span className="truncate">{command.title}</span>
				{command.detail && (
					<span className="truncate text-muted-foreground text-xs">
						{command.detail}
					</span>
				)}
			</span>
			{toggle && command.checked && (
				<CheckIcon aria-hidden className="size-4 shrink-0" />
			)}
			{command.shortcut && (
				<kbd
					aria-label={shortcutLabel(command.shortcut)}
					className="flex shrink-0 gap-0.5 font-sans text-muted-foreground text-xs"
				>
					{shortcutKeys(command.shortcut).map((key) => (
						<span key={key} className="rounded border bg-muted px-1">
							{key}
						</span>
					))}
				</kbd>
			)}
			{active && !command.shortcut && (
				<CornerDownLeftIcon
					aria-hidden
					className="size-3.5 shrink-0 text-muted-foreground"
				/>
			)}
		</div>
	);
}
