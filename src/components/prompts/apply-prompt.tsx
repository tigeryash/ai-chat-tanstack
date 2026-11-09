import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currentVersion, type Prompt } from "@/lib/prompts/prompt";
import { searchPrompts } from "@/lib/prompts/search";
import { usePrompts } from "@/lib/prompts/use-prompts";

// Apply a saved prompt (roadmap 3.6) from a chat's Model settings: its current text becomes the chat's
// own system prompt. Outside the composer on purpose (hard rule 8).

export function ApplyPrompt({
	onApply,
}: {
	onApply: (prompt: Prompt) => void;
}) {
	const [open, setOpen] = useState(false);
	return (
		<div className="flex flex-col gap-2">
			<Button
				variant="link"
				size="sm"
				className="self-start px-0"
				aria-expanded={open}
				onClick={() => setOpen((current) => !current)}
			>
				{open ? "Hide saved prompts" : "Apply a saved prompt"}
			</Button>
			{open && (
				<SavedPrompts
					onApply={(prompt) => {
						onApply(prompt);
						setOpen(false);
					}}
				/>
			)}
		</div>
	);
}

function SavedPrompts({ onApply }: { onApply: (prompt: Prompt) => void }) {
	const list = usePrompts();
	const [query, setQuery] = useState("");
	if (list.status === "loading") return null;
	if (list.status === "error") {
		return (
			<p role="alert" className="text-destructive text-sm">
				Couldn't load your saved prompts.
			</p>
		);
	}
	if (list.prompts.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				No saved prompts yet. Add them under Prompts in the sidebar.
			</p>
		);
	}
	const shown = searchPrompts(list.prompts, query);
	return (
		<section aria-label="Saved prompts" className="flex flex-col gap-2">
			<Input
				type="search"
				aria-label="Search saved prompts"
				placeholder="Search name, text or #tag"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
			/>
			<ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
				{shown.map((prompt) => (
					<li
						key={prompt.id}
						className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
					>
						<span className="flex min-w-0 flex-col">
							<span className="truncate font-medium text-sm">
								{prompt.name}
							</span>
							<span className="line-clamp-1 text-muted-foreground text-xs">
								{currentVersion(prompt).text}
							</span>
						</span>
						<Button
							size="xs"
							variant="outline"
							aria-label={`Apply ${prompt.name}`}
							onClick={() => onApply(prompt)}
						>
							Apply
						</Button>
					</li>
				))}
				{shown.length === 0 && (
					<li className="text-muted-foreground text-sm">
						No prompts match your search.
					</li>
				)}
			</ul>
		</section>
	);
}
