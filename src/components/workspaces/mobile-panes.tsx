import type { ReactNode } from "react";
import type { WorkspacePane } from "@/lib/storage/workspace";
import { steppedIndex } from "@/lib/workspaces/pane-tabs";
import { usePaneSwipe } from "@/lib/workspaces/use-pane-swipe";
import { panePanelId, paneTabId } from "./pane-tabs";

/**
 * Below `md` (roadmap 3.8): one pane at a time, as the tab panel of its tab in the header. Swiping
 * left or right shows the next or previous pane. The others stay mounted (hidden), so a synced send
 * still reaches them.
 */
export function MobilePanes({
	panes,
	shownId,
	onShow,
	renderPane,
}: {
	panes: readonly WorkspacePane[];
	shownId: string | undefined;
	onShow: (chatId: string) => void;
	renderPane: (pane: WorkspacePane, index: number) => ReactNode;
}) {
	const swipe = usePaneSwipe((step) => {
		const index = panes.findIndex((pane) => pane.chatId === shownId);
		const next = panes[steppedIndex(index, step, panes.length) ?? -1];
		if (next) onShow(next.chatId);
	});
	return (
		<div {...swipe} data-pane-swipe className="flex min-h-0 flex-1 flex-col">
			{panes.map((pane, index) => (
				<div
					key={pane.chatId}
					id={panePanelId(pane.chatId)}
					role="tabpanel"
					aria-labelledby={paneTabId(pane.chatId)}
					hidden={pane.chatId !== shownId}
					className="min-h-0 flex-1"
				>
					{renderPane(pane, index)}
				</div>
			))}
		</div>
	);
}
