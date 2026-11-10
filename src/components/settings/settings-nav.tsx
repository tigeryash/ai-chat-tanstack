import {
	BellIcon,
	BoxesIcon,
	DatabaseIcon,
	KeyboardIcon,
	KeyRoundIcon,
	type LucideIcon,
	MessageSquareIcon,
	PaletteIcon,
	ScrollTextIcon,
	SearchIcon,
	ShieldIcon,
	SlidersHorizontalIcon,
	UserIcon,
} from "lucide-react";
import { type ReactNode, type Ref, useId } from "react";
import {
	type SettingMatch,
	searchSettings,
	visibleSettingsSections,
} from "@/lib/settings/registry";
import {
	SETTINGS_GROUPS,
	type SettingsSectionId,
} from "@/lib/settings/sections";
import { cn } from "@/lib/utils";

const SECTION_ICONS: Record<SettingsSectionId, LucideIcon> = {
	general: SlidersHorizontalIcon,
	appearance: PaletteIcon,
	chat: MessageSquareIcon,
	keyboard: KeyboardIcon,
	notifications: BellIcon,
	models: BoxesIcon,
	connections: KeyRoundIcon,
	prompts: ScrollTextIcon,
	data: DatabaseIcon,
	privacy: ShieldIcon,
	account: UserIcon,
};

const ITEM_CLASS =
	"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring";

interface SettingsNavProps {
	section: SettingsSectionId;
	query: string;
	onQueryChange: (query: string) => void;
	onSelect: (section: SettingsSectionId) => void;
	onPick: (match: SettingMatch) => void;
	searchRef: Ref<HTMLInputElement>;
}

/** The left side of Settings: a search box over the grouped sections, or over the search's results. */
export function SettingsNav({
	section,
	query,
	onQueryChange,
	onSelect,
	onPick,
	searchRef,
}: SettingsNavProps) {
	const results = searchSettings(query);
	const searching = query.trim() !== "";

	return (
		<div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
			<div className="relative">
				<SearchIcon
					aria-hidden
					className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
				/>
				<input
					ref={searchRef}
					type="search"
					aria-label="Search settings"
					placeholder="Search settings"
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					onKeyDown={(event) => {
						const first = results[0];
						if (event.key === "Enter" && first) {
							event.preventDefault();
							onPick(first);
						}
					}}
					className="h-9 w-full rounded-md border border-input bg-background pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
				/>
			</div>
			<div className="min-h-0 overflow-y-auto">
				{searching ? (
					<SearchResults query={query} results={results} onPick={onPick} />
				) : (
					<SectionList current={section} onSelect={onSelect} />
				)}
			</div>
		</div>
	);
}

function SectionList({
	current,
	onSelect,
}: {
	current: SettingsSectionId;
	onSelect: (section: SettingsSectionId) => void;
}) {
	const visible = visibleSettingsSections();
	return (
		<nav aria-label="Settings sections" className="grid gap-4">
			{SETTINGS_GROUPS.map((group) => {
				const sections = visible.filter((s) => s.group === group.id);
				if (sections.length === 0) return null;
				return (
					<SectionGroup key={group.id} label={group.label}>
						{sections.map((s) => {
							const Icon = SECTION_ICONS[s.id];
							const active = s.id === current;
							return (
								<li key={s.id}>
									<button
										type="button"
										aria-current={active ? "page" : undefined}
										onClick={() => onSelect(s.id)}
										className={cn(
											ITEM_CLASS,
											active &&
												"bg-sidebar-accent font-medium text-sidebar-accent-foreground",
										)}
									>
										<Icon aria-hidden className="size-4 shrink-0" />
										{s.label}
									</button>
								</li>
							);
						})}
					</SectionGroup>
				);
			})}
		</nav>
	);
}

function SectionGroup({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	const id = useId();
	return (
		<div className="grid gap-1">
			<p
				id={id}
				className="px-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
			>
				{label}
			</p>
			<ul aria-labelledby={id} className="grid gap-0.5">
				{children}
			</ul>
		</div>
	);
}

function SearchResults({
	query,
	results,
	onPick,
}: {
	query: string;
	results: SettingMatch[];
	onPick: (match: SettingMatch) => void;
}) {
	if (results.length === 0) {
		return (
			<p role="status" className="px-2 py-1.5 text-muted-foreground text-sm">
				No settings match “{query.trim()}”.
			</p>
		);
	}
	return (
		<ul aria-label="Search results" className="grid gap-0.5">
			{results.map((match) => (
				<li key={match.setting.id}>
					<button
						type="button"
						onClick={() => onPick(match)}
						className={cn(ITEM_CLASS, "grid gap-0")}
					>
						<span className="truncate">{match.setting.label}</span>
						<span className="truncate text-muted-foreground text-xs">
							{match.section.label}
						</span>
					</button>
				</li>
			))}
		</ul>
	);
}
