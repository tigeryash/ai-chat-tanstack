import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	checkBaseUrl,
	ENDPOINT_KINDS,
	ENDPOINT_PRESETS,
	type EndpointDraft,
	type EndpointKind,
} from "@/lib/local-endpoints/endpoints";

const KIND_LABELS: Record<EndpointKind, string> = {
	lmstudio: "LM Studio",
	ollama: "Ollama",
	custom: "Other OpenAI-compatible server",
};

/** Adds or edits a local endpoint. Saving calls nothing: "Test connection" does that. */
export function LocalEndpointForm({
	initial,
	submitLabel,
	onSave,
	onCancel,
}: {
	initial?: EndpointDraft;
	submitLabel: string;
	onSave: (draft: EndpointDraft) => void;
	onCancel: () => void;
}) {
	const id = useId();
	const [kind, setKind] = useState<EndpointKind>(initial?.kind ?? "lmstudio");
	const [name, setName] = useState(
		initial?.name ?? ENDPOINT_PRESETS.lmstudio.name,
	);
	const [baseUrl, setBaseUrl] = useState(
		initial?.baseUrl ?? ENDPOINT_PRESETS.lmstudio.baseUrl,
	);
	const [error, setError] = useState<string | null>(null);

	const pickKind = (next: EndpointKind) => {
		// Follow the preset unless the user already typed their own name or URL.
		const presetNames = Object.values(ENDPOINT_PRESETS).map((p) => p.name);
		const presetUrls = Object.values(ENDPOINT_PRESETS).map((p) => p.baseUrl);
		if (presetNames.includes(name)) setName(ENDPOINT_PRESETS[next].name);
		if (presetUrls.includes(baseUrl))
			setBaseUrl(ENDPOINT_PRESETS[next].baseUrl);
		setKind(next);
	};

	const submit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const checked = checkBaseUrl(baseUrl);
		if (!checked.ok) {
			setError(checked.error);
			return;
		}
		try {
			onSave({ kind, name, baseUrl: checked.url });
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Couldn't save the endpoint.",
			);
		}
	};

	return (
		<form onSubmit={submit} className="grid max-w-xl gap-3">
			<RadioGroup
				aria-label="Server"
				value={kind}
				onValueChange={(next) => pickKind(next as EndpointKind)}
				className="gap-2"
			>
				{ENDPOINT_KINDS.map((value) => (
					<div key={value} className="flex items-center gap-2">
						<RadioGroupItem id={`${id}-${value}`} value={value} />
						<Label htmlFor={`${id}-${value}`}>{KIND_LABELS[value]}</Label>
					</div>
				))}
			</RadioGroup>
			<div className="grid gap-1.5">
				<Label htmlFor={`${id}-name`}>Name</Label>
				<Input
					id={`${id}-name`}
					value={name}
					maxLength={60}
					onChange={(event) => setName(event.target.value)}
				/>
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor={`${id}-url`}>Base URL</Label>
				<Input
					id={`${id}-url`}
					type="url"
					spellCheck={false}
					autoCapitalize="off"
					value={baseUrl}
					onChange={(event) => {
						setBaseUrl(event.target.value);
						setError(null);
					}}
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? `${id}-error` : `${id}-hint`}
					required
				/>
				{error ? (
					<p id={`${id}-error`} className="text-destructive text-sm">
						{error}
					</p>
				) : (
					<p id={`${id}-hint`} className="text-muted-foreground text-xs">
						The server's OpenAI-compatible API, usually ending in /v1. Only
						localhost and 127.0.0.1 addresses work.
					</p>
				)}
			</div>
			<div className="flex gap-2">
				<Button type="submit" size="sm">
					{submitLabel}
				</Button>
				<Button type="button" variant="ghost" size="sm" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		</form>
	);
}
