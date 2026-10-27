import { Link } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOCAL_BASE_URL } from "@/lib/chat/language-model";
import { listModels, type ModelList } from "@/lib/chat/list-models";
import {
	type ChatProviderId,
	LOCAL_PROVIDER,
	type ModelChoice,
	providerName,
} from "@/lib/chat/model-selection";
import type { ProviderId } from "@/lib/keys";
import { listProviderKeys } from "@/lib/keys/vault";
import { logError } from "@/lib/log";

// TEMPORARY until roadmap 2.2's model picker: a provider dropdown (connected providers plus a local
// server) and a model name, typed or picked from the provider's own model list.

const SELECT_CLASS =
	"h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function useConnectedProviders(): ProviderId[] | null {
	const [connected, setConnected] = useState<ProviderId[] | null>(null);
	useEffect(() => {
		listProviderKeys()
			.then((keys) => setConnected(keys.map((key) => key.providerId)))
			.catch((error) => {
				logError("Couldn't read saved API keys:", error);
				setConnected([]);
			});
	}, []);
	return connected;
}

function useModelList(provider: ChatProviderId) {
	const [loaded, setLoaded] = useState<{
		provider: ChatProviderId;
		list: ModelList;
	} | null>(null);
	useEffect(() => {
		let current = true;
		listModels(provider).then((list) => {
			if (current) setLoaded({ provider, list });
		});
		return () => {
			current = false;
		};
	}, [provider]);
	return loaded?.provider === provider ? loaded.list : null;
}

function modelHint(provider: ChatProviderId, list: ModelList | null): string {
	if (!list) return "Loading models…";
	if (list.ok) return `${list.models.length} models. Pick one or type a name.`;
	if (provider === LOCAL_PROVIDER) {
		return `Couldn't reach LM Studio at ${new URL(LOCAL_BASE_URL).host}. Start its server with CORS enabled, or type a model name.`;
	}
	return "Couldn't load the model list. Type a model name.";
}

export interface ModelPickerProps {
	choice: ModelChoice | null;
	onChange: (choice: ModelChoice) => void;
}

export function ModelPicker({ choice, onChange }: ModelPickerProps) {
	const id = useId();
	const connected = useConnectedProviders();
	const provider: ChatProviderId =
		choice?.provider ?? connected?.[0] ?? LOCAL_PROVIDER;
	const model = choice?.provider === provider ? choice.model : "";
	const models = useModelList(provider);

	const options: ChatProviderId[] = [...(connected ?? []), LOCAL_PROVIDER];
	if (!options.includes(provider)) options.unshift(provider);

	return (
		<div className="flex flex-wrap items-end gap-3 px-4 py-2">
			<div className="grid gap-1">
				<Label htmlFor={`${id}-provider`}>Provider</Label>
				<select
					id={`${id}-provider`}
					className={SELECT_CLASS}
					value={provider}
					onChange={(event) =>
						onChange({
							provider: event.target.value as ChatProviderId,
							model: "",
						})
					}
				>
					{options.map((option) => (
						<option key={option} value={option}>
							{option === LOCAL_PROVIDER
								? "Local (LM Studio)"
								: providerName(option)}
						</option>
					))}
				</select>
			</div>
			<div className="grid min-w-64 flex-1 gap-1">
				<Label htmlFor={`${id}-model`}>Model</Label>
				<Input
					id={`${id}-model`}
					list={`${id}-models`}
					value={model}
					placeholder="Model name"
					autoComplete="off"
					spellCheck={false}
					aria-describedby={`${id}-hint`}
					onChange={(event) =>
						onChange({ provider, model: event.target.value })
					}
				/>
				<datalist id={`${id}-models`}>
					{models?.ok &&
						models.models.map((name) => <option key={name} value={name} />)}
				</datalist>
			</div>
			<p id={`${id}-hint`} className="w-full text-xs text-muted-foreground">
				{modelHint(provider, models)}{" "}
				{connected?.length === 0 && (
					<>
						No provider connected yet.{" "}
						<Link to="/settings" className="underline">
							Add a key in Settings
						</Link>
						.
					</>
				)}
			</p>
		</div>
	);
}
