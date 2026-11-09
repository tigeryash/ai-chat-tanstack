import { Button } from "@/components/ui/button";
import {
	unreadableFiles,
	unreadableNotice,
} from "@/lib/attachments/capability";
import type { AttachmentSupport } from "@/lib/attachments/validate";
import { type PaneSync, usePaneSyncState } from "@/lib/workspaces/pane-sync";

/**
 * A synced pane's note about attached files its model can't read (roadmap 3.3, decision 17), shown as
 * soon as they're attached, above the composer (not in it, hard rule 8). The pane can take the message
 * without them ("Send text only", the default) or sit this send out ("Skip this pane").
 */
export function PaneAttachmentNotice({
	hub,
	paneId,
	support,
}: {
	hub: PaneSync;
	paneId: string;
	support: AttachmentSupport | undefined;
}) {
	const { attachments, skipped } = usePaneSyncState(hub);
	const unreadable = unreadableFiles(attachments, support);
	if (unreadable.length === 0) return null;
	const skip = skipped.includes(paneId);
	return (
		<div
			role="status"
			aria-label="Attachments this model can't read"
			className="mb-3 flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 rounded-md border bg-muted px-3 py-2 text-muted-foreground text-sm"
		>
			<p className="min-w-0 flex-1">{unreadableNotice(unreadable, skip)}</p>
			<div className="flex shrink-0 gap-2">
				<Button
					size="sm"
					variant={skip ? "outline" : "secondary"}
					aria-pressed={!skip}
					onClick={() => hub.setSkipped(paneId, false)}
				>
					Send text only
				</Button>
				<Button
					size="sm"
					variant={skip ? "secondary" : "outline"}
					aria-pressed={skip}
					onClick={() => hub.setSkipped(paneId, true)}
				>
					Skip this pane
				</Button>
			</div>
		</div>
	);
}
