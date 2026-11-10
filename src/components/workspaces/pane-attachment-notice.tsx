import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	unreadableFiles,
	unreadableNotice,
} from "@/lib/attachments/capability";
import type { AttachmentSupport } from "@/lib/attachments/validate";
import { type PaneSync, usePaneSyncState } from "@/lib/workspaces/pane-sync";

const TEXT_ONLY = "text-only";
const SKIP = "skip";

/**
 * A synced pane's note about attached files its model can't read (roadmap 3.3, decision 17), shown as
 * soon as they're attached, above the composer (not in it, hard rule 8). One choice for the next send,
 * as a radio group: the pane takes the message without them ("Send text only", the default) or sits
 * this send out ("Skip this pane"). The choice holds until the send, whichever synced composer sends.
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
	const sentence = useId();
	const unreadable = unreadableFiles(attachments, support);
	if (unreadable.length === 0) return null;
	const skip = skipped.includes(paneId);
	return (
		<div className="mb-3 flex w-full max-w-3xl flex-col gap-2 rounded-md border border-warning px-3 py-2 text-sm">
			<p id={sentence} className="text-warning">
				{unreadableNotice(unreadable, skip)}
			</p>
			<RadioGroup
				aria-label="Attachments this model can't read"
				aria-describedby={sentence}
				value={skip ? SKIP : TEXT_ONLY}
				onValueChange={(value) => hub.setSkipped(paneId, value === SKIP)}
				className="flex flex-wrap gap-x-4 gap-y-1"
			>
				<Choice value={TEXT_ONLY} label="Send text only" />
				<Choice value={SKIP} label="Skip this pane" />
			</RadioGroup>
		</div>
	);
}

function Choice({ value, label }: { value: string; label: string }) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: the radio inside it is the control (Base UI renders a button)
		<label className="flex cursor-pointer items-center gap-2 text-muted-foreground has-data-checked:font-medium has-data-checked:text-foreground">
			<RadioGroupItem value={value} />
			{label}
		</label>
	);
}
