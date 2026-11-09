import { useNavigate } from "@tanstack/react-router";
import { LayoutTemplateIcon, LinkIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { currentViewer } from "@/lib/account";
import { logError } from "@/lib/log";
import { modelLinkHref } from "@/lib/workspaces/model-link";
import {
	deleteLayout,
	LAYOUT_NAME_MAX,
	type LayoutPane,
	modelLabel,
	type SavedLayout,
	saveLayout,
	suggestLayoutName,
	useSavedLayouts,
} from "@/lib/workspaces/saved-layouts";
import { createWorkspaceWith } from "@/lib/workspaces/workspace-sessions";

// Saved layouts (roadmap 3.5): save this workspace's pane models and widths under a name, copy a
// `?models=` link to them, and open a saved layout as a new workspace with fresh chats.

type Notice = { kind: "status" | "alert"; text: string } | undefined;

/**
 * `current` reads the shown panes when the person saves or copies (left out where there's nothing to
 * save, like `/new`, which only opens saved layouts).
 */
export function LayoutsMenu({ current }: { current?: () => LayoutPane[] }) {
	const layouts = useSavedLayouts();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [notice, setNotice] = useState<Notice>();
	const nameId = useId();

	const save = () => {
		if (!current) return;
		try {
			const layout = saveLayout(name, current());
			setName("");
			setNotice({ kind: "status", text: `Saved “${layout.name}”.` });
		} catch (error) {
			logError("Couldn't save the layout:", error);
			setNotice({ kind: "alert", text: "Couldn't save the layout." });
		}
	};
	const copyLink = async () => {
		if (!current) return;
		const ids = current().flatMap((pane) =>
			pane.model?.gatewayId ? [pane.model.gatewayId] : [],
		);
		const href = modelLinkHref(ids, window.location.origin);
		if (!href) {
			setNotice({
				kind: "alert",
				text: "Links only name catalog models; these panes have none.",
			});
			return;
		}
		try {
			await navigator.clipboard.writeText(href);
			setNotice({ kind: "status", text: "Link copied." });
		} catch (error) {
			logError("Couldn't copy the link:", error);
			setNotice({ kind: "alert", text: "Couldn't copy the link." });
		}
	};
	const openLayout = async (layout: SavedLayout) => {
		try {
			const workspaceId = await createWorkspaceWith(
				layout.panes,
				await currentViewer(),
			);
			setOpen(false);
			await navigate({ to: "/w/$workspaceId", params: { workspaceId } });
		} catch (error) {
			logError("Couldn't open the layout:", error);
			setNotice({ kind: "alert", text: "Couldn't open the layout." });
		}
	};

	if (!current && layouts.length === 0) return null;
	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				setNotice(undefined);
				if (next && current) setName(suggestLayoutName(current()));
			}}
		>
			<PopoverTrigger
				render={<Button variant="ghost" size="sm" aria-label="Layouts" />}
			>
				<LayoutTemplateIcon />
				<span className="max-sm:sr-only">Layouts</span>
			</PopoverTrigger>
			<PopoverContent align="end" aria-label="Layouts" className="w-80 gap-3">
				{current && (
					<form
						className="flex flex-col gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							save();
						}}
					>
						<label htmlFor={nameId} className="font-medium">
							Save this layout
						</label>
						<div className="flex gap-2">
							<Input
								id={nameId}
								value={name}
								maxLength={LAYOUT_NAME_MAX}
								onChange={(event) => setName(event.target.value)}
								placeholder="Layout name"
							/>
							<Button type="submit" size="sm">
								Save
							</Button>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => void copyLink()}
						>
							<LinkIcon />
							Copy link to these models
						</Button>
					</form>
				)}
				{notice && (
					<p
						role={notice.kind}
						className={
							notice.kind === "alert"
								? "text-destructive text-xs"
								: "text-muted-foreground text-xs"
						}
					>
						{notice.text}
					</p>
				)}
				<SavedLayoutList
					layouts={layouts}
					onOpen={(layout) => void openLayout(layout)}
				/>
			</PopoverContent>
		</Popover>
	);
}

function SavedLayoutList({
	layouts,
	onOpen,
}: {
	layouts: readonly SavedLayout[];
	onOpen: (layout: SavedLayout) => void;
}) {
	return (
		<section aria-label="Saved layouts" className="flex flex-col gap-1">
			<PopoverTitle className="text-muted-foreground text-xs">
				Saved layouts
			</PopoverTitle>
			{layouts.length === 0 ? (
				<p className="text-muted-foreground text-xs">No saved layouts yet.</p>
			) : (
				<ul className="flex flex-col gap-1">
					{[...layouts].reverse().map((layout) => (
						<li key={layout.id} className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="sm"
								className="h-auto min-w-0 flex-1 flex-col items-start gap-0 py-1 text-left"
								aria-label={`Open ${layout.name}`}
								onClick={() => onOpen(layout)}
							>
								<span className="w-full truncate">{layout.name}</span>
								<span className="w-full truncate font-normal text-muted-foreground text-xs">
									{layout.panes
										.map((pane) => modelLabel(pane.model))
										.join(", ")}
								</span>
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={`Delete ${layout.name}`}
								title="Delete"
								onClick={() => deleteLayout(layout.id)}
							>
								<Trash2Icon />
							</Button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
