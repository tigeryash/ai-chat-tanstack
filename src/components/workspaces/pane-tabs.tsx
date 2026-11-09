import { type KeyboardEvent, useEffect, useRef } from "react";
import type { WorkspacePane } from "@/lib/storage/workspace";
import { cn } from "@/lib/utils";
import { tabIndexForKey } from "@/lib/workspaces/pane-tabs";

/** The ids that tie a pane's tab and its panel together (`aria-controls`, `aria-labelledby`). */
export const paneTabId = (chatId: string) => `pane-tab-${chatId}`;
export const panePanelId = (chatId: string) => `pane-${chatId}`;

/**
 * The pane tabs on a narrow screen (roadmap 3.8), in the header: WAI-ARIA tabs with a roving tab
 * stop, arrows (wrapping), Home and End. Moving with the keyboard shows that pane right away; every
 * pane stays mounted, so switching is instant.
 */
export function PaneTabs({
	panes,
	shownId,
	onShow,
}: {
	panes: readonly WorkspacePane[];
	shownId: string;
	onShow: (chatId: string) => void;
}) {
	const list = useRef<HTMLDivElement>(null);

	// A swipe changes the shown pane from outside, so keep its tab in view in a scrolling tab row.
	useEffect(() => {
		const tab = list.current?.querySelector<HTMLElement>(
			`#${CSS.escape(paneTabId(shownId))}`,
		);
		tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
	}, [shownId]);

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const index = panes.findIndex((pane) => pane.chatId === shownId);
		const next = panes[tabIndexForKey(event.key, index, panes.length) ?? -1];
		if (!next) return;
		event.preventDefault();
		onShow(next.chatId);
		document.getElementById(paneTabId(next.chatId))?.focus();
	};

	return (
		<div
			ref={list}
			role="tablist"
			aria-label="Panes"
			onKeyDown={onKeyDown}
			className="flex min-w-0 gap-1 overflow-x-auto"
		>
			{panes.map((pane, index) => {
				const selected = pane.chatId === shownId;
				return (
					<button
						key={pane.chatId}
						id={paneTabId(pane.chatId)}
						type="button"
						role="tab"
						aria-selected={selected}
						aria-controls={panePanelId(pane.chatId)}
						tabIndex={selected ? 0 : -1}
						onClick={() => onShow(pane.chatId)}
						className={cn(
							"shrink-0 rounded-md px-2.5 py-1 text-muted-foreground text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
							selected && "bg-muted text-foreground",
						)}
					>
						Pane {index + 1}
					</button>
				);
			})}
		</div>
	);
}
