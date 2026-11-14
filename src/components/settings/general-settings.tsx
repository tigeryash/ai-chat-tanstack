import { ModelPicker } from "@/components/models/model-picker";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
	DEFAULT_MODEL_MODES,
	type DefaultModelMode,
	useDefaultModelSetting,
} from "@/lib/chat/default-model";
import {
	LOCAL_PROVIDER,
	type ModelChoice,
	providerName,
} from "@/lib/chat/model-selection";
import { useTitleModelSetting } from "@/lib/chat/title-model";
import { useConnectedProviders } from "@/lib/keys/use-connected-providers";
import { useCatalogModel, useModelCatalog } from "@/lib/models/catalog";
import type { SettingControlProps } from "./setting-row-props";

// Settings → General (roadmap R2 S2): the model new chats start on, and the model that names chats.
// Both pick with the chat header's model picker, and are kept in this browser
// (`src/lib/chat/default-model.ts`, `src/lib/chat/title-model.ts`).

const MODE_LABELS: Record<DefaultModelMode, string> = {
	last: "The model I used last",
	fixed: "Always this model",
};

const NO_NEEDS = { images: false };

/** The model picker for a setting: the stored choice as is, against the catalog and the keys here. */
function SettingModelPicker({
	choice,
	onChange,
}: {
	choice: ModelChoice | null;
	onChange: (choice: ModelChoice) => void;
}) {
	const catalog = useModelCatalog();
	const connected = useConnectedProviders();
	const models = catalog.data?.models;
	const gatewayId = choice?.gatewayId;
	const listed = models?.find((model) => model.gatewayId === gatewayId);
	const lookup = useCatalogModel(models && !listed ? gatewayId : undefined);
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-2">
			<ModelPicker
				choice={choice}
				wanted={choice}
				needs={NO_NEEDS}
				chosenModel={listed ?? lookup.data ?? undefined}
				onChange={onChange}
				catalog={{
					models,
					failed: catalog.isError,
					retry: () => void catalog.refetch(),
				}}
				connected={connected}
			/>
			<MissingKey choice={choice} />
		</div>
	);
}

/** Says when the picked model's provider has no key here, so it can't run yet. */
function MissingKey({ choice }: { choice: ModelChoice | null }) {
	const connected = useConnectedProviders();
	if (!choice?.model || choice.provider === LOCAL_PROVIDER || !connected) {
		return null;
	}
	if (connected.has(choice.provider)) return null;
	return (
		<p className="text-muted-foreground text-sm">
			There's no {providerName(choice.provider)} key in this browser yet.
		</p>
	);
}

export function DefaultModelControl({
	controlId,
	labelId,
	descriptionId,
}: SettingControlProps) {
	const [setting, setSetting] = useDefaultModelSetting();
	return (
		<div className="grid gap-3">
			<RadioGroup
				aria-labelledby={labelId}
				aria-describedby={descriptionId}
				value={setting.mode}
				onValueChange={(mode) =>
					setSetting({ ...setting, mode: mode as DefaultModelMode })
				}
				className="flex flex-wrap gap-4"
			>
				{DEFAULT_MODEL_MODES.map((mode) => (
					<div key={mode} className="flex items-center gap-2">
						<RadioGroupItem id={`${controlId}-${mode}`} value={mode} />
						<Label htmlFor={`${controlId}-${mode}`}>{MODE_LABELS[mode]}</Label>
					</div>
				))}
			</RadioGroup>
			{setting.mode === "fixed" && (
				<SettingModelPicker
					choice={setting.choice ?? null}
					onChange={(choice) => setSetting({ mode: "fixed", choice })}
				/>
			)}
		</div>
	);
}

export function TitleModelControl({
	controlId,
	descriptionId,
}: SettingControlProps) {
	const [setting, setSetting] = useTitleModelSetting();
	return (
		<div className="grid gap-3">
			<div className="flex items-center gap-2">
				<Switch
					id={controlId}
					aria-describedby={descriptionId}
					checked={setting.enabled}
					onCheckedChange={(enabled) => setSetting({ ...setting, enabled })}
				/>
				<Label htmlFor={controlId}>Write titles with a model</Label>
			</div>
			{setting.enabled && (
				<SettingModelPicker
					choice={setting.choice ?? null}
					onChange={(choice) => setSetting({ enabled: true, choice })}
				/>
			)}
		</div>
	);
}
