import { Button } from "@/components/ui/button";
import type { ModelChoice } from "@/lib/chat/model-selection";
import type { ChatNeeds } from "@/lib/hosts/host-options";
import type { ProviderId } from "@/lib/keys/providers";
import { markNetworkAccessExplained } from "@/lib/local-endpoints/network-access";
import type { CatalogModel } from "@/lib/models/catalog";
import {
	DEFAULT_FILTERS,
	developersOf,
	type PickerFilters,
} from "@/lib/models/picker-filter";
import { ModelPickerFilters } from "./model-picker-filters";
import {
	CatalogSection,
	CustomSection,
	LocalSection,
} from "./model-picker-list";
import { ModelPreview } from "./model-preview";
import type { useLocalModels } from "./use-local-models";
import { usePickerEntries } from "./use-picker-entries";

// What the open model picker shows: filters, the lists and the preview. It mounts only while the
// picker is open, so its catalog work (`usePickerEntries`) never runs for a closed picker.

export interface ModelPickerPanelProps {
	catalog: {
		models?: readonly CatalogModel[];
		failed: boolean;
		retry: () => void;
	};
	filters: PickerFilters;
	setFilters: (next: PickerFilters) => void;
	local: ReturnType<typeof useLocalModels>;
	connected: ReadonlySet<ProviderId> | null;
	choice: ModelChoice | null;
	chosenModel: CatalogModel | undefined;
	needs: ChatNeeds;
	previewId: string | undefined;
	onPreview: (gatewayId: string | undefined) => void;
	/** A list row was picked. */
	onPick: (choice: ModelChoice) => void;
	/** The preview chose a host; `close` when the picker should close. */
	onChoose: (choice: ModelChoice, close: boolean) => void;
}

export function ModelPickerPanel({
	catalog,
	filters,
	setFilters,
	local,
	connected,
	choice,
	chosenModel,
	needs,
	previewId,
	onPreview,
	onPick,
	onChoose,
}: ModelPickerPanelProps) {
	const localOnly = filters.view === "local";
	const models = catalog.models ?? [];
	const { entries, customTargets } = usePickerEntries({
		models,
		filters,
		connected: connected ?? new Set<ProviderId>(),
		choice,
		localEndpoints: local.endpoints,
	});
	// The hovered or focused row, else the chat's model while it's listed, else the first row.
	const listed = (id: string | undefined) =>
		entries.find((entry) => entry.model.gatewayId === id)?.model;
	const previewed =
		listed(previewId) ?? listed(chosenModel?.gatewayId) ?? entries[0]?.model;

	return (
		<>
			<ModelPickerFilters
				filters={filters}
				developers={developersOf(models)}
				onChange={setFilters}
			/>
			<div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,25rem)]">
				<div className="max-h-[min(28rem,45vh)] overflow-y-auto p-1 sm:max-h-[min(34rem,70vh)]">
					{!catalog.models && !catalog.failed && !localOnly && (
						<p className="p-3 text-muted-foreground text-sm">Loading models…</p>
					)}
					{catalog.failed && !localOnly && (
						<p className="flex items-center gap-2 p-3 text-sm" role="alert">
							Couldn't load the model catalog.
							<Button size="sm" variant="outline" onClick={catalog.retry}>
								Retry
							</Button>
						</p>
					)}
					{catalog.models && entries.length === 0 && !localOnly && (
						<p className="p-3 text-muted-foreground text-sm">
							No models match.{" "}
							{filters.view === "high-elo" && "Try All models, or "}
							<button
								type="button"
								className="underline"
								onClick={() =>
									setFilters({ ...DEFAULT_FILTERS, view: filters.view })
								}
							>
								clear the filters
							</button>
							.
						</p>
					)}
					{entries.length > 0 && (
						<CatalogSection
							entries={entries}
							choice={choice}
							onPick={onPick}
							onPreview={onPreview}
						/>
					)}
					<LocalSection
						local={local}
						search={filters.search}
						choice={choice}
						onPick={onPick}
						onExplained={markNetworkAccessExplained}
					/>
					{!localOnly && (
						<CustomSection
							search={filters.search}
							targets={customTargets}
							onPick={onPick}
						/>
					)}
				</div>
				{previewed && (
					<div className="max-h-[min(24rem,40vh)] overflow-y-auto border-t sm:max-h-[min(34rem,70vh)] sm:border-t-0 sm:border-l">
						<ModelPreview
							model={previewed}
							choice={choice}
							connected={connected}
							needs={needs}
							onChoose={onChoose}
						/>
					</div>
				)}
			</div>
			<p className="border-t px-3 py-2 text-muted-foreground text-xs">
				Intelligence Index by{" "}
				<a
					href="https://artificialanalysis.ai"
					target="_blank"
					rel="noopener noreferrer"
					className="underline"
				>
					Artificial Analysis
				</a>
				. Prices are USD per million input / output tokens.
			</p>
		</>
	);
}
