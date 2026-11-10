import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	currentVersion,
	type Prompt,
	type PromptVersion,
	versionOf,
} from "@/lib/prompts/prompt";
import { cn } from "@/lib/utils";
import { PromptDiff } from "./prompt-diff";

// A saved prompt's versions (roadmap 3.6), newest first. Picking one shows what changed from it to the
// current text; restoring it adds its text again as the newest version.

const when = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

function versionLabel(entry: PromptVersion, isCurrent: boolean): string {
	const parts = [`Version ${entry.version}`];
	if (isCurrent) parts.push("current");
	if (entry.restoredFrom) parts.push(`restored from ${entry.restoredFrom}`);
	return parts.join(" · ");
}

export function PromptHistory({
	prompt,
	onRestore,
	busy,
	initialVersion,
}: {
	prompt: Prompt;
	onRestore: (version: number) => void;
	busy: boolean;
	/** The version to show first (a link from a reply, roadmap 3.6b); else the one before current. */
	initialVersion?: number;
}) {
	const current = currentVersion(prompt);
	const previous = prompt.versions.at(-2)?.version;
	const [picked, setPicked] = useState(initialVersion);
	const selected =
		versionOf(prompt, picked ?? previous ?? current.version) ??
		versionOf(prompt, previous ?? current.version);
	const newestFirst = [...prompt.versions].reverse();

	return (
		<section aria-label="Version history" className="flex flex-col gap-3">
			<h3 className="font-medium text-sm">Version history</h3>
			<ul className="flex flex-col gap-1" aria-label="Versions">
				{newestFirst.map((entry) => {
					const isCurrent = entry.version === current.version;
					const isSelected = entry.version === selected?.version;
					return (
						<li key={entry.version}>
							<button
								type="button"
								aria-pressed={isSelected}
								onClick={() => setPicked(entry.version)}
								className={cn(
									"flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted",
									isSelected && "bg-muted",
								)}
							>
								<span>{versionLabel(entry, isCurrent)}</span>
								<span className="text-muted-foreground text-xs">
									{when.format(entry.createdAt)}
								</span>
							</button>
						</li>
					);
				})}
			</ul>
			{initialVersion !== undefined && !versionOf(prompt, initialVersion) && (
				<p className="text-muted-foreground text-xs">
					Version {initialVersion} is no longer in this prompt's history.
				</p>
			)}
			{selected && selected.version !== current.version && (
				<div className="flex flex-col gap-2">
					<PromptDiff
						before={selected.text}
						after={current.text}
						label={`Changes from version ${selected.version} to the current version`}
					/>
					<Button
						size="sm"
						variant="outline"
						className="self-start"
						disabled={busy}
						onClick={() => {
							onRestore(selected.version);
							setPicked(undefined);
						}}
					>
						Restore version {selected.version}
					</Button>
				</div>
			)}
			{prompt.versions.length === 1 && (
				<p className="text-muted-foreground text-xs">
					Each time you save new text, the old text stays here as a version.
				</p>
			)}
		</section>
	);
}
