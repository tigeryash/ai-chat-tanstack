import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	LOCAL_PROVIDER,
	type ModelChoice,
	providerName,
} from "@/lib/chat/model-selection";
import type { ChatNeeds } from "@/lib/hosts/host-options";
import type { ProviderId } from "@/lib/keys/providers";
import { markNetworkAccessExplained } from "@/lib/local-endpoints/network-access";
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
	type CustomTarget,
	LocalSection,
} from "./model-picker-list";
import { ModelPreview } from "./model-preview";
import { useLocalModels } from "./use-local-models";

// The chat header's model picker (roadmap 2.2, decision 14). Opens on the High Elo view; every
// catalog model is listed under "All models", runnable or not.

export interface ModelPickerProps {
	/** The chat's choice, resolved to the host it runs on now. */
	choice: ModelChoice | null;
	/** What the user picked (Auto or a pinned host), kept when the same model is picked again. */
	wanted: ModelChoice | null;
	/** What the chat needs from a host (an attached image). */
	needs: ChatNeeds;
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
	wanted,
	needs,
	chosenModel,
	onChange,
	catalog,
	connected,
}: ModelPickerProps) {
	const [open, setOpen] = useState(false);
	const [filters, setFilters] = useState<PickerFilters>(DEFAULT_FILTERS);
	const [previewId, setPreviewId] = useState<string | undefined>();
	const local = useLocalModels(open);
	const connectedSet = connected ?? new Set<ProviderId>();

	const models = catalog.models ?? [];
	const entries = filterModels(models, filters).map((model) =>
		entryFor(model, connectedSet, choice),
	);
	const customTargets: CustomTarget[] = [
		...[...connectedSet].map(
			(provider): CustomTarget => ({
				key: provider,
				label: providerName(provider),
				logo: provider,
				choice: { provider },
			}),
		),
		...local.endpoints.map(
			({ endpoint }): CustomTarget => ({
				key: endpoint.id,
				label: endpoint.name,
				logo: LOCAL_PROVIDER,
				choice: { provider: LOCAL_PROVIDER, endpoint: endpoint.id },
			}),
		),
	];

	const choose = (next: ModelChoice, close: boolean) => {
		onChange(next);
		if (close) setOpen(false);
	};
	/** A list row: the same model keeps its host settings; another one starts on Auto. */
	const pick = (next: ModelChoice) => {
		const same = next.gatewayId && next.gatewayId === wanted?.gatewayId;
		choose(
			same ? wanted : next.gatewayId ? { ...next, autoHost: true } : next,
			true,
		);
	};
	// The hovered or focused row, else the chat's model while it's listed, else the first row.
	const listed = (id: string | undefined) =>
		entries.find((entry) => entry.model.gatewayId === id)?.model;
	const previewed =
		listed(previewId) ?? listed(chosenModel?.gatewayId) ?? entries[0]?.model;
	const label = triggerLabel(choice ?? wanted, chosenModel);

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setPreviewId(undefined);
			}}
		>
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
				className="w-[min(62rem,calc(100vw-2rem))] gap-0 p-0"
			>
				<ModelPickerFilters
					filters={filters}
					developers={developersOf(models)}
					onChange={setFilters}
				/>
				<div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,25rem)]">
					<div className="max-h-[min(28rem,45vh)] overflow-y-auto p-1 sm:max-h-[min(34rem,70vh)]">
						{!catalog.models && !catalog.failed && (
							<p className="p-3 text-muted-foreground text-sm">
								Loading models…
							</p>
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
							<CatalogSection
								entries={entries}
								choice={choice}
								onPick={pick}
								onPreview={setPreviewId}
							/>
						)}
						<LocalSection
							local={local}
							search={filters.search}
							choice={choice}
							onPick={pick}
							onExplained={markNetworkAccessExplained}
						/>
						<CustomSection
							search={filters.search}
							targets={customTargets}
							onPick={pick}
						/>
					</div>
					{previewed && (
						<div className="max-h-[min(24rem,40vh)] overflow-y-auto border-t sm:max-h-[min(34rem,70vh)] sm:border-t-0 sm:border-l">
							<ModelPreview
								model={previewed}
								choice={choice}
								connected={connected}
								needs={needs}
								onChoose={choose}
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
			</PopoverContent>
		</Popover>
	);
}
