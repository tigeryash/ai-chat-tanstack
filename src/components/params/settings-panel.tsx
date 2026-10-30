import { SlidersHorizontalIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { type ParamValues, withParam } from "@/lib/params/settings";
import { ParamControl } from "./param-controls";
import type { ChatParams } from "./use-chat-params";

// The chat's model settings (roadmap 2.4b, decision 15), opened from the sliders button next to the
// model header. Shows only what the model and host take; each pane gets its own in roadmap 3.1.

const FIELD =
	"w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** A textarea that saves when it loses focus, not on every key. */
function PromptField({
	label,
	value,
	placeholder,
	onSave,
	describedBy,
}: {
	label: string;
	value: string;
	placeholder?: string;
	onSave: (value: string) => void;
	describedBy?: string;
}) {
	const [draft, setDraft] = useState<string | undefined>(undefined);
	return (
		<textarea
			aria-label={label}
			aria-describedby={describedBy}
			rows={4}
			className={FIELD}
			placeholder={placeholder}
			value={draft ?? value}
			onChange={(event) => setDraft(event.target.value)}
			onBlur={() => {
				if (draft !== undefined && draft !== value) onSave(draft);
				setDraft(undefined);
			}}
		/>
	);
}

function SystemPrompt({ params }: { params: ChatParams }) {
	const helpId = useId();
	const own = params.settings.systemPrompt;
	const [editShared, setEditShared] = useState(false);
	const save = (prompt: string) => {
		const { systemPrompt: _, ...rest } = params.settings;
		params.update(
			prompt.trim() === "" ? rest : { ...rest, systemPrompt: prompt },
		);
	};
	return (
		<section className="flex flex-col gap-1.5" aria-label="System prompt">
			<span className="font-medium text-sm">System prompt</span>
			<PromptField
				label="System prompt for this chat"
				value={own ?? ""}
				placeholder={params.sharedPrompt || "None"}
				onSave={save}
				describedBy={helpId}
			/>
			<p id={helpId} className="text-muted-foreground text-xs">
				{own === undefined
					? "Empty: this chat uses your default prompt."
					: "This chat's own prompt. Clear it to use your default."}
			</p>
			<Button
				variant="link"
				size="sm"
				className="self-start px-0"
				aria-expanded={editShared}
				onClick={() => setEditShared((open) => !open)}
			>
				{editShared ? "Hide default prompt" : "Edit default prompt"}
			</Button>
			{editShared && (
				<PromptField
					label="Default system prompt"
					value={params.sharedPrompt}
					placeholder="Used by every chat without its own"
					onSave={params.setSharedPrompt}
				/>
			)}
		</section>
	);
}

export function SettingsPanel({
	params,
	modelName,
}: {
	params: ChatParams;
	modelName: string | undefined;
}) {
	const { settings, support } = params;
	const setParam = <K extends keyof ParamValues>(
		id: K,
		value: ParamValues[K] | undefined,
	) =>
		params.update({
			...settings,
			params: withParam(settings.params, id, value),
		});
	const empty = support.params.length === 0;

	return (
		<Sheet>
			<SheetTrigger
				render={
					<Button variant="ghost" size="icon-sm" aria-label="Model settings" />
				}
			>
				<SlidersHorizontalIcon />
			</SheetTrigger>
			<SheetContent className="overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Model settings</SheetTitle>
					<SheetDescription>
						{modelName
							? `For this chat with ${modelName}. Only settings it supports are shown.`
							: "Pick a model first."}
					</SheetDescription>
				</SheetHeader>
				<div className="flex flex-col gap-5 px-4 pb-4">
					{empty ? (
						<p className="text-muted-foreground text-sm">
							{params.loading
								? "Checking what this model supports…"
								: "No settings are known to work with this model and host, so none are shown."}
						</p>
					) : (
						support.params.map((id) => (
							<ParamControl
								key={id}
								id={id}
								support={support}
								values={settings.params}
								onChange={setParam}
							/>
						))
					)}
					{!empty && (
						<Button
							variant="outline"
							size="sm"
							className="self-start"
							disabled={Object.keys(settings.params).length === 0}
							onClick={() => params.update({ ...settings, params: {} })}
						>
							Reset to defaults
						</Button>
					)}
					<SystemPrompt params={params} />
				</div>
			</SheetContent>
		</Sheet>
	);
}
