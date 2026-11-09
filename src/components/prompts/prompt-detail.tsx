import { useState } from "react";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/log";
import { currentVersion, type Prompt, parseTags } from "@/lib/prompts/prompt";
import { promptStore } from "@/lib/prompts/prompt-store";
import { type PromptFields, PromptForm } from "./prompt-form";
import { PromptHistory } from "./prompt-history";

// One saved prompt (roadmap 3.6): edit its name, tags and text (new text is a new version), see its
// history with a diff, restore an old version, or delete it.

const fieldsOf = (prompt: Prompt): PromptFields => ({
	name: prompt.name,
	tags: prompt.tags.join(", "),
	text: currentVersion(prompt).text,
});

export function PromptDetail({
	prompt,
	onDeleted,
}: {
	prompt: Prompt;
	onDeleted: () => void;
}) {
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);
	const run = async (action: () => Promise<unknown>) => {
		setBusy(true);
		setFailed(false);
		try {
			await action();
		} catch (error) {
			// The store's errors carry codes and paths, never the prompt's text (hard rule 4).
			logError("Couldn't update the prompt:", error);
			setFailed(true);
		} finally {
			setBusy(false);
		}
	};
	const save = (fields: PromptFields) =>
		run(async () => {
			const store = promptStore();
			await store.setLabels(prompt.id, {
				name: fields.name,
				tags: parseTags(fields.tags),
			});
			await store.saveText(prompt.id, fields.text);
		});

	return (
		<article
			aria-label={prompt.name}
			className="flex flex-col gap-6 rounded-pane border bg-card p-4"
		>
			{failed && (
				<p role="alert" className="text-destructive text-sm">
					Couldn't save that change. Try again.
				</p>
			)}
			<PromptForm
				// A new version (a save elsewhere, a restore) resets the form to it.
				key={`${prompt.id}:${currentVersion(prompt).version}:${prompt.updatedAt}`}
				initial={fieldsOf(prompt)}
				submitLabel="Save"
				onSubmit={save}
				busy={busy}
			/>
			<PromptHistory
				key={prompt.id}
				prompt={prompt}
				busy={busy}
				onRestore={(version) =>
					run(() => promptStore().restoreVersion(prompt.id, version))
				}
			/>
			<Button
				variant="destructive"
				size="sm"
				className="self-start"
				disabled={busy}
				onClick={() =>
					run(async () => {
						await promptStore().deletePrompt(prompt.id);
						onDeleted();
					})
				}
			>
				Delete prompt
			</Button>
		</article>
	);
}
