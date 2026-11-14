import { Dialog } from "@base-ui/react/dialog";
import { ArrowLeftIcon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { settingToHighlight } from "@/lib/settings/navigation";
import type { SettingId, SettingMatch } from "@/lib/settings/registry";
import {
	DEFAULT_SETTINGS_SECTION,
	type SettingsSectionId,
	settingsSection,
} from "@/lib/settings/sections";
import { cn } from "@/lib/utils";
import { settingRowId } from "./setting-row";
import { SettingsNav } from "./settings-nav";
import { SettingsSectionBody } from "./settings-section";

// Settings (roadmap R2 S1, docs/settings-research.md "Layout decision"): a large centered dialog over
// any page, opened by `?settings=<section>`. A grouped section nav with search on the left, one section
// on the right. Below `md` it's a full-screen sheet: the section list first, then one section.
// Under reduced motion it only fades (`data-fade-only` in src/styles.css keeps the fade).

type PhoneView = "list" | "section";

/** On a phone, a link to a particular section opens it; Settings itself opens on the list. */
function phoneViewFor(section: SettingsSectionId | undefined): PhoneView {
	return section && section !== DEFAULT_SETTINGS_SECTION ? "section" : "list";
}

const HIGHLIGHT_MS = 2000;
const SCROLL_MARGIN_PX = 16;

function isWide(): boolean {
	return window.matchMedia("(min-width: 768px)").matches;
}

export function SettingsDialog({
	section,
	onSelect,
	onClose,
}: {
	/** The open section, or `undefined` when Settings is closed. */
	section: SettingsSectionId | undefined;
	onSelect: (section: SettingsSectionId) => void;
	onClose: () => void;
}) {
	const open = section !== undefined;
	// Switching sections waits for a navigation; show the new one at once, and keep the last one
	// on screen while the dialog fades out.
	const [shown, setShown] = useState(section ?? DEFAULT_SETTINGS_SECTION);
	const [lastSection, setLastSection] = useState(section);
	const [query, setQuery] = useState("");
	// Settings mounts on its first open, so that open starts here rather than in the check below.
	const [phoneView, setPhoneView] = useState(() =>
		section && settingToHighlight() ? "section" : phoneViewFor(section),
	);
	const [highlight, setHighlight] = useState<{ id: SettingId } | null>(() => {
		const target = section ? settingToHighlight() : null;
		return target ? { id: target } : null;
	});
	if (section !== lastSection) {
		setLastSection(section);
		if (section) setShown(section);
		if (section && !lastSection) {
			// The command palette can open Settings at a row (roadmap R2 S5).
			const target = settingToHighlight();
			setQuery("");
			setHighlight(target ? { id: target } : null);
			setPhoneView(target ? "section" : phoneViewFor(section));
		}
	}

	const searchRef = useRef<HTMLInputElement>(null);
	const contentRef = useRef<HTMLElement>(null);
	const headingId = useId();

	// Always navigates: `section` lags behind a switch that is still navigating, so comparing with it
	// would drop a quick second switch and let the first one's late navigation win.
	const select = (next: SettingsSectionId) => {
		setShown(next);
		setPhoneView("section");
		onSelect(next);
	};

	const pick = ({ setting }: SettingMatch) => {
		select(setting.section);
		setHighlight({ id: setting.id });
	};

	// A new section starts at its top.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the section changes
	useEffect(() => {
		contentRef.current?.scrollTo({ top: 0 });
	}, [shown]);

	// A search result scrolls to its row, focuses it, and highlights it for a moment.
	useEffect(() => {
		if (!highlight) return;
		const row = document.getElementById(settingRowId(highlight.id));
		const content = contentRef.current;
		if (row && content) {
			// Scrolls only the section: `scrollIntoView` would also scroll the dialog itself.
			const offset =
				row.getBoundingClientRect().top - content.getBoundingClientRect().top;
			content.scrollTo({ top: content.scrollTop + offset - SCROLL_MARGIN_PX });
		}
		row?.focus({ preventScroll: true });
		const timer = setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
		return () => clearTimeout(timer);
	}, [highlight]);

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next, details) => {
				if (next) return;
				// Esc in a search with text clears the search first.
				if (details.reason === "escape-key" && query) {
					details.cancel();
					setQuery("");
					return;
				}
				onClose();
			}}
		>
			<Dialog.Portal>
				<Dialog.Backdrop
					data-fade-only
					className="fixed inset-0 z-50 bg-overlay/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs"
				/>
				<Dialog.Popup
					data-fade-only
					data-testid="settings-dialog"
					initialFocus={() =>
						(highlight &&
							document.getElementById(settingRowId(highlight.id))) ||
						(isWide() ? searchRef.current : true)
					}
					className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background text-foreground outline-none transition-[opacity,scale] duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-[0.98] motion-safe:data-starting-style:scale-[0.98] md:inset-auto md:top-1/2 md:left-1/2 md:h-[min(46rem,calc(100dvh-4rem))] md:w-[min(64rem,calc(100vw-4rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:flex-row md:rounded-pane md:border md:shadow-2xl"
				>
					<aside
						className={cn(
							"flex min-h-0 flex-col gap-3 bg-sidebar p-3 text-sidebar-foreground max-md:flex-1 md:w-60 md:shrink-0 md:border-r",
							phoneView === "section" && "max-md:hidden",
						)}
					>
						<div className="flex items-center justify-between md:hidden">
							<p className="px-1 font-semibold">Settings</p>
							<CloseButton />
						</div>
						<SettingsNav
							section={shown}
							query={query}
							onQueryChange={setQuery}
							onSelect={select}
							onPick={pick}
							searchRef={searchRef}
						/>
					</aside>
					<div
						className={cn(
							"flex min-h-0 min-w-0 flex-1 flex-col",
							phoneView === "list" && "max-md:hidden",
						)}
					>
						<header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 md:px-6">
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="All settings"
								className="md:hidden"
								onClick={() => setPhoneView("list")}
							>
								<ArrowLeftIcon />
							</Button>
							<Dialog.Title className="flex min-w-0 items-center gap-1.5 font-normal text-sm">
								<span className="text-muted-foreground">Settings</span>
								<span aria-hidden className="text-muted-foreground">
									/
								</span>
								<span id={headingId} className="truncate font-medium">
									{settingsSection(shown).label}
								</span>
							</Dialog.Title>
							<CloseButton className="ml-auto" />
						</header>
						<section
							ref={contentRef}
							aria-labelledby={headingId}
							className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [overflow-anchor:none] md:p-6"
						>
							<div className="mx-auto max-w-3xl">
								<SettingsSectionBody
									section={shown}
									highlighted={highlight?.id ?? null}
									onSelect={select}
								/>
							</div>
						</section>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

function CloseButton({ className }: { className?: string }) {
	return (
		<Dialog.Close
			aria-label="Close settings"
			render={<Button variant="ghost" size="icon-sm" className={className} />}
		>
			<XIcon />
		</Dialog.Close>
	);
}
