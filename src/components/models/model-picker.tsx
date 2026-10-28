import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	type ChatProviderId,
	LOCAL_PROVIDER,
	type ModelChoice,
} from "@/lib/chat/model-selection";
import type { ProviderId } from "@/lib/keys/providers";
import type { CatalogModel } from "@/lib/models/catalog";
import {
	DEFAULT_FILTERS,
	developersOf,
	filterModels,
	type PickerFilters,
} from "@/lib/models/picker-filter";
import { routesFor } from "@/lib/models/runnability";
import { ModelLogo } from "./model-logo";
import { ModelPickerFilters } from "./model-picker-filters";
import {
	type CatalogEntry,
	CatalogSection,
	CustomSection,
	LocalSection,
} from "./model-picker-list";
import { useLocalModels } from "./use-local-models";

// The chat header's model picker (roadmap 2.2, decision 14). Opens on the High Elo view; every
// catalog model is listed under "All models", runnable or not.

export interface ModelPickerProps {
	choice: ModelChoice | null;
	/** The choice's catalog model, if it has one (removed models included). */
	chosenModel: CatalogModel | undefined;
	onChange: (choice: ModelChoice) => void;
	catalog: {
		models?: readonly CatalogModel[];
		failed: boolean;
		retry: () => void;
	};
	/** Providers with a key in this browser; null while loading. */
	connected: ReadonlySet<ProviderId> | null;
}

/** The route to keep when re-picking: the chosen provider if it still serves the model. */
function entryFor(
	model: CatalogModel,
	connected: ReadonlySet<ProviderId>,
	choice: ModelChoice | null,
): CatalogEntry {
	const routes = routesFor(model, connected);
	const current =
		choice?.gatewayId === model.gatewayId
			? routes.find((route) => route.provider === choice.provider)
			: undefined;
	return { model, route: current ?? routes[0] };
}

function triggerLabel(
	choice: ModelChoice | null,
	chosenModel: CatalogModel | undefined,
) {
	if (chosenModel) return chosenModel.name;
	if (choice?.model) return choice.model;
	return "Pick a model";
}

export function ModelPicker({
	choice,
	chosenModel,
	onChange,
	catalog,
	connected,
}: ModelPickerProps) {
	const [open, setOpen] = useState(false);
	const [filters, setFilters] = useState<PickerFilters>(DEFAULT_FILTERS);
	const local = useLocalModels(open);
	const connectedSet = connected ?? new Set<ProviderId>();

	const models = catalog.models ?? [];
	const entries = filterModels(models, filters).map((model) =>
		entryFor(model, connectedSet, choice),
	);
	const customProviders: ChatProviderId[] = [...connectedSet, LOCAL_PROVIDER];

	const pick = (next: ModelChoice) => {
		onChange(next);
		setOpen(false);
	};
	const label = triggerLabel(choice, chosenModel);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						variant="ghost"
						className="gap-2 font-medium"
						aria-label={`Model: ${label}`}
					/>
				}
			>
				<ModelLogo
					developer={
						chosenModel?.developer ??
						(choice?.provider === LOCAL_PROVIDER ? LOCAL_PROVIDER : "")
					}
				/>
				<span className="max-w-64 truncate">{label}</span>
				<ChevronDownIcon aria-hidden="true" className="size-4 opacity-60" />
			</PopoverTrigger>
			<PopoverContent
				align="start"
				aria-label="Choose a model"
				className="w-[min(38rem,calc(100vw-2rem))] gap-0 p-0"
			>
				<ModelPickerFilters
					filters={filters}
					developers={developersOf(models)}
					onChange={setFilters}
				/>
				<div className="max-h-[min(28rem,60vh)] overflow-y-auto p-1">
					{!catalog.models && !catalog.failed && (
						<p className="p-3 text-muted-foreground text-sm">Loading models…</p>
					)}
					{catalog.failed && (
						<p className="flex items-center gap-2 p-3 text-sm" role="alert">
							Couldn't load the model catalog.
							<Button size="sm" variant="outline" onClick={catalog.retry}>
								Retry
							</Button>
						</p>
					)}
					{catalog.models && entries.length === 0 && (
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
						<CatalogSection entries={entries} choice={choice} onPick={pick} />
					)}
					<LocalSection
						list={local}
						search={filters.search}
						choice={choice}
						onPick={pick}
					/>
					<CustomSection
						search={filters.search}
						providers={customProviders}
						onPick={pick}
					/>
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
			</PopoverContent>
		</Popover>
	);
}
