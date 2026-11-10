import { useId, useState } from "react";
import { Label } from "@/components/ui/label";
import { useViewer } from "@/lib/account";
import { logError } from "@/lib/log";
import type { Prompt } from "@/lib/prompts/prompt";
import { promptStore } from "@/lib/prompts/prompt-store";
import { usePrompts } from "@/lib/prompts/use-prompts";

// A model's default prompt (roadmap 3.6b, decision 19), in a chat's Model settings: a saved prompt every
// chat and pane with this model uses unless it has its own. It follows the prompt's edits (new chats get
// the newest version), and deleting the prompt goes back to the shared default prompt.

const NONE = "";

export function ModelDefaultPrompt({
	modelKey,
	modelName,
	current,
}: {
	modelKey: string;
	modelName: string;
	current: Prompt | undefined;
}) {
	const id = useId();
	const helpId = useId();
	const viewer = useViewer();
	const list = usePrompts();
	const [failed, setFailed] = useState(false);
	if (list.status !== "ready" || list.prompts.length === 0) return null;

	const change = async (promptId: string) => {
		if (viewer === undefined) return;
		setFailed(false);
		try {
			await promptStore().setModelDefault(
				modelKey,
				promptId === NONE ? null : promptId,
				viewer,
			);
		} catch (error) {
			// Codes and ids only, never the prompt's text (hard rule 4).
			logError("Couldn't set the model's default prompt:", error);
			setFailed(true);
		}
	};

	return (
		<div className="grid gap-1.5">
			<Label htmlFor={id}>Default prompt for {modelName}</Label>
			<select
				id={id}
				aria-describedby={helpId}
				value={current?.id ?? NONE}
				disabled={viewer === undefined}
				onChange={(event) => void change(event.target.value)}
				className="h-9 rounded-md border border-input bg-background px-2 text-foreground text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
			>
				<option value={NONE}>None (use your default prompt)</option>
				{list.prompts.map((prompt) => (
					<option key={prompt.id} value={prompt.id}>
						{prompt.name}
					</option>
				))}
			</select>
			<p id={helpId} className="text-muted-foreground text-xs">
				Chats with this model that have no prompt of their own use it, always at
				its newest version.
			</p>
			{failed && (
				<p role="alert" className="text-destructive text-xs">
					Couldn't change the default prompt. Try again.
				</p>
			)}
		</div>
	);
}
