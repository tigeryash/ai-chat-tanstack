import { Button } from "@/components/ui/button";
import type { CatalogModel } from "@/lib/models/catalog";
import { formatMonth } from "@/lib/models/format";

// Shown on a chat whose model left the catalog (roadmap 2.1b, decision 14). The chat stays readable;
// the banner suggests the newest model from the same developer and family.

export function RemovedModelBanner({
	model,
	replacement,
	onSwitch,
}: {
	model: CatalogModel;
	replacement: CatalogModel | undefined;
	onSwitch: (replacement: CatalogModel) => void;
}) {
	const since = formatMonth(model.removedAt);
	return (
		<div
			role="status"
			className="mx-4 my-2 flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
		>
			<span className="flex-1">
				{model.name} is no longer offered
				{since ? ` (removed ${since})` : ""}.
				{replacement
					? ` The newest in its family is ${replacement.name}.`
					: " Pick another model to keep chatting."}
			</span>
			{replacement && (
				<Button
					size="sm"
					variant="outline"
					onClick={() => onSwitch(replacement)}
				>
					Switch to {replacement.name}
				</Button>
			)}
		</div>
	);
}
