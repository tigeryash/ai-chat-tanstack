import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { track } from "@/lib/analytics/track";
import { LOCAL_PROVIDER, type ModelChoice } from "@/lib/chat/model-selection";
import type { ChatNeeds } from "@/lib/hosts/host-options";
import type { ProviderId } from "@/lib/keys/providers";
import type { CatalogModel } from "@/lib/models/catalog";
import {
	DEFAULT_FILTERS,
	type PickerFilters,
} from "@/lib/models/picker-filter";
import { usePickerView } from "@/lib/models/picker-view";
import { ModelLogo } from "./model-logo";
import { ModelPickerPanel } from "./model-picker-panel";
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

/** `model_picked` with the catalog's developer id (or local / custom) and whether it's High Elo. */
function trackPick(next: ModelChoice, models: readonly CatalogModel[]) {
	const model = next.gatewayId
		? models.find((entry) => entry.gatewayId === next.gatewayId)
		: undefined;
	track("model_picked", {
		developer:
			model?.developer ??
			(next.provider === LOCAL_PROVIDER ? LOCAL_PROVIDER : "custom"),
		highElo: model?.highElo ?? false,
	});
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
	const [view, setView] = usePickerView();
	const [otherFilters, setOtherFilters] =
		useState<PickerFilters>(DEFAULT_FILTERS);
	const filters = { ...otherFilters, view };
	const setFilters = (next: PickerFilters) => {
		setOtherFilters(next);
		if (next.view !== view) setView(next.view);
	};
	const [previewId, setPreviewId] = useState<string | undefined>();
	const local = useLocalModels(open);

	const choose = (next: ModelChoice, close: boolean) => {
		if (next.gatewayId !== choice?.gatewayId || next.model !== choice?.model) {
			trackPick(next, catalog.models ?? []);
		}
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
						variant="outline"
						size="sm"
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
				<ModelPickerPanel
					catalog={catalog}
					filters={filters}
					setFilters={setFilters}
					local={local}
					connected={connected}
					choice={choice}
					chosenModel={chosenModel}
					needs={needs}
					previewId={previewId}
					onPreview={setPreviewId}
					onPick={pick}
					onChoose={choose}
				/>
			</PopoverContent>
		</Popover>
	);
}
