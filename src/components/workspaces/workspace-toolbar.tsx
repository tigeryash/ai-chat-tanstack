import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspacePane } from "@/lib/storage/workspace";
import { cn } from "@/lib/utils";
import { canAddPane } from "@/lib/workspaces/pane-layout";

const DIVERGED_HINT =
	"Synced panes have different histories, so their replies aren't like for like. Sending again doesn't share history between panes.";

/**
 * Above a workspace's panes: the pane switcher on narrow screens (roadmap 3.1; 3.8 polishes it), the
 * "Diverged" badge (decision 16), and Add pane.
 */
export function WorkspaceToolbar({
	panes,
	shownId,
	onShow,
	diverged,
	saveFailed,
	onAddPane,
}: {
	panes: readonly WorkspacePane[];
	/** The pane shown on a narrow screen; undefined when every pane shows. */
	shownId: string | undefined;
	onShow: (chatId: string) => void;
	diverged: boolean;
	saveFailed: boolean;
	onAddPane: () => void;
}) {
	return (
		<div className="flex min-w-0 flex-1 items-center gap-2">
			{shownId !== undefined && (
				<div
					role="tablist"
					aria-label="Panes"
					className="flex min-w-0 gap-1 overflow-x-auto"
				>
					{panes.map((pane, index) => (
						<button
							key={pane.chatId}
							type="button"
							role="tab"
							aria-selected={pane.chatId === shownId}
							aria-controls={`pane-${pane.chatId}`}
							onClick={() => onShow(pane.chatId)}
							className={cn(
								"rounded-md px-2.5 py-1 text-muted-foreground text-sm",
								pane.chatId === shownId && "bg-muted text-foreground",
							)}
						>
							Pane {index + 1}
						</button>
					))}
				</div>
			)}
			<div className="ml-auto flex items-center gap-2">
				{saveFailed && (
					<span role="alert" className="text-destructive text-xs">
						Couldn't save the layout in this browser.
					</span>
				)}
				{diverged && (
					<Badge variant="outline" role="status" title={DIVERGED_HINT}>
						Diverged
					</Badge>
				)}
				<Button
					variant="ghost"
					size="sm"
					disabled={!canAddPane(panes)}
					onClick={onAddPane}
				>
					<PlusIcon />
					Add pane
				</Button>
			</div>
		</div>
	);
}
