import { PlusIcon } from "lucide-react";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
	warned,
	diverged,
	saveFailed,
	onAddPane,
	hiddenPanes,
	currentLayout,
	missingModels = 0,
	syncScroll,
}: {
	panes: readonly WorkspacePane[];
	/** The pane shown on a narrow screen; undefined when every pane shows. */
	shownId: string | undefined;
	onShow: (chatId: string) => void;
	/** Panes whose model can't read an attached file (roadmap 3.3), marked on their tabs. */
	warned?: readonly string[];
	diverged: boolean;
	saveFailed: boolean;
	onAddPane: () => void;
	/** Panes of another account's chats the record keeps (roadmap 1.9); they count toward the limit. */
	hiddenPanes: number;
	/** The shown panes as a layout to save (roadmap 3.5). */
	currentLayout: () => LayoutPane[];
	/** Models a deep link named that the catalog doesn't list (roadmap 3.5). */
	missingModels?: number;
	/** The sync scroll switch (roadmap 3.4); undefined when one pane shows. */
	syncScroll?: { on: boolean; onChange: (on: boolean) => void };
}) {
	const syncScrollId = useId();
	return (
		<div className="flex min-w-0 flex-1 items-center gap-2">
			{shownId !== undefined && (
				<PaneTabs
					panes={panes}
					shownId={shownId}
					onShow={onShow}
					warned={warned}
				/>
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
				{syncScroll && (
					<label
						htmlFor={syncScrollId}
						title="Scrolling one pane scrolls the others to the same place"
						className="flex items-center gap-1.5 text-muted-foreground text-xs"
					>
						<Switch
							id={syncScrollId}
							size="sm"
							checked={syncScroll.on}
							onCheckedChange={syncScroll.onChange}
						/>
						Sync scroll
					</label>
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
