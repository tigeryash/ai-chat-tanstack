import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useViewer } from "@/lib/account";
import { logError } from "@/lib/log";
import { currentVersion, type Prompt, parseTags } from "@/lib/prompts/prompt";
import { promptStore } from "@/lib/prompts/prompt-store";
import { type PromptFields, PromptForm } from "./prompt-form";
import { PromptHistory } from "./prompt-history";

// One saved prompt (roadmap 3.6): edit its name, tags and text (new text is a new version), see its
// history with a diff, restore an old version, or delete it. It also lists the models it's the default
// prompt for (roadmap 3.6b); those are set from a chat's Model settings.

const fieldsOf = (prompt: Prompt): PromptFields => ({
	name: prompt.name,
	tags: prompt.tags.join(", "),
	text: currentVersion(prompt).text,
});

function DefaultFor({
	prompt,
	busy,
	onRemove,
}: {
	prompt: Prompt;
	busy: boolean;
	onRemove: (key: string) => void;
}) {
	const models = prompt.defaultFor ?? [];
	if (models.length === 0) return null;
	return (
		<section aria-label="Default prompt for" className="flex flex-col gap-2">
			<h3 className="font-medium text-sm">Default prompt for</h3>
			<p className="text-muted-foreground text-xs">
				Chats with these models that have no prompt of their own use this
				prompt's newest version. If you delete it, they use your default prompt
				again.
			</p>
			<ul className="flex flex-col gap-1">
				{models.map((key) => (
					<li
						key={key}
						className="flex items-center justify-between gap-2 text-sm"
					>
						<span className="min-w-0 break-all font-mono text-xs">{key}</span>
						<Button
							size="xs"
							variant="outline"
							disabled={busy}
							aria-label={`Stop using as the default for ${key}`}
							onClick={() => onRemove(key)}
						>
							Remove
						</Button>
					</li>
				))}
			</ul>
		</section>
	);
}

export function PromptDetail({
	prompt,
	onDeleted,
	initialVersion,
}: {
	prompt: Prompt;
	onDeleted: () => void;
	initialVersion?: number;
}) {
	const viewer = useViewer();
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
			<DefaultFor
				prompt={prompt}
				busy={busy || viewer === undefined}
				onRemove={(key) =>
					run(() => promptStore().setModelDefault(key, null, viewer ?? null))
				}
			/>
			<PromptHistory
				key={prompt.id}
				prompt={prompt}
				initialVersion={initialVersion}
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
