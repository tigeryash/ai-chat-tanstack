import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspacePane } from "@/lib/storage/workspace";
import { canAddPane } from "@/lib/workspaces/pane-layout";
import type { LayoutPane } from "@/lib/workspaces/saved-layouts";
import { LayoutsMenu } from "./layouts-menu";
import { PaneTabs } from "./pane-tabs";

const DIVERGED_HINT =
	"Synced panes have different histories, so their replies aren't like for like. Sending again doesn't share history between panes.";

/**
 * Above a workspace's panes: the pane tabs on narrow screens (roadmap 3.8), the "Diverged" badge
 * (decision 16), saved layouts (3.5), and Add pane.
 */
export function WorkspaceToolbar({
	panes,
	shownId,
	onShow,
	diverged,
	saveFailed,
	onAddPane,
	hiddenPanes,
	currentLayout,
	missingModels = 0,
}: {
	panes: readonly WorkspacePane[];
	/** The pane shown on a narrow screen; undefined when every pane shows. */
	shownId: string | undefined;
	onShow: (chatId: string) => void;
	diverged: boolean;
	saveFailed: boolean;
	onAddPane: () => void;
	/** Panes of another account's chats the record keeps (roadmap 1.9); they count toward the limit. */
	hiddenPanes: number;
	/** The shown panes as a layout to save (roadmap 3.5). */
	currentLayout: () => LayoutPane[];
	/** Models a deep link named that the catalog doesn't list (roadmap 3.5). */
	missingModels?: number;
}) {
	return (
		<div className="flex min-w-0 flex-1 items-center gap-2">
			{shownId !== undefined && (
				<PaneTabs panes={panes} shownId={shownId} onShow={onShow} />
			)}
			<div className="ml-auto flex items-center gap-2">
				{saveFailed && (
					<span role="alert" className="text-destructive text-xs">
						Couldn't save the layout in this browser.
					</span>
				)}
				{missingModels > 0 && (
					<span role="status" className="text-muted-foreground text-xs">
						{missingModels === 1
							? "1 model from the link isn't in the catalog."
							: `${missingModels} models from the link aren't in the catalog.`}
					</span>
				)}
				{diverged && (
					<Badge variant="outline" role="status" title={DIVERGED_HINT}>
						Diverged
					</Badge>
				)}
				<LayoutsMenu current={currentLayout} />
				{/* Icon-only on a phone, like Layouts, so the pane tabs keep their room. */}
				<Button
					variant="ghost"
					size="sm"
					disabled={!canAddPane(panes, hiddenPanes)}
					onClick={onAddPane}
				>
					<PlusIcon />
					<span className="max-sm:sr-only">Add pane</span>
				</Button>
			</div>
		</div>
	);
}
