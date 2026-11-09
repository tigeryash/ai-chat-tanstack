import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_SYSTEM_PROMPT_LENGTH } from "@/lib/params/settings";
import { MAX_PROMPT_NAME_LENGTH } from "@/lib/prompts/prompt";

// The fields of a saved prompt (roadmap 3.6): name, comma-separated tags and text. Used to create a
// prompt and to edit one; the caller decides what saving does.

export interface PromptFields {
	name: string;
	tags: string;
	text: string;
}

const TEXTAREA =
	"min-h-48 w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PromptForm({
	initial,
	submitLabel,
	onSubmit,
	onCancel,
	busy,
}: {
	initial: PromptFields;
	submitLabel: string;
	onSubmit: (fields: PromptFields) => void;
	onCancel?: () => void;
	busy?: boolean;
}) {
	const id = useId();
	const [fields, setFields] = useState(initial);
	const set = (key: keyof PromptFields) => (value: string) =>
		setFields((current) => ({ ...current, [key]: value }));
	const unchanged =
		fields.name === initial.name &&
		fields.tags === initial.tags &&
		fields.text === initial.text;

	return (
		<form
			className="flex flex-col gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit(fields);
			}}
		>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`${id}-name`}>Name</Label>
				<Input
					id={`${id}-name`}
					value={fields.name}
					maxLength={MAX_PROMPT_NAME_LENGTH}
					placeholder="Untitled prompt"
					onChange={(event) => set("name")(event.target.value)}
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`${id}-tags`}>Tags</Label>
				<Input
					id={`${id}-tags`}
					value={fields.tags}
					placeholder="writing, code review"
					aria-describedby={`${id}-tags-help`}
					onChange={(event) => set("tags")(event.target.value)}
				/>
				<p id={`${id}-tags-help`} className="text-muted-foreground text-xs">
					Separate tags with commas.
				</p>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`${id}-text`}>Prompt</Label>
				<textarea
					id={`${id}-text`}
					className={TEXTAREA}
					value={fields.text}
					maxLength={MAX_SYSTEM_PROMPT_LENGTH}
					onChange={(event) => set("text")(event.target.value)}
				/>
			</div>
			<div className="flex gap-2">
				<Button type="submit" size="sm" disabled={busy || unchanged}>
					{submitLabel}
				</Button>
				{onCancel && (
					<Button type="button" variant="ghost" size="sm" onClick={onCancel}>
						Cancel
					</Button>
				)}
			</div>
		</form>
	);
}
