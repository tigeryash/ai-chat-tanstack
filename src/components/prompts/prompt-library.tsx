import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useViewer } from "@/lib/account";
import { logError } from "@/lib/log";
import { currentVersion, type Prompt, parseTags } from "@/lib/prompts/prompt";
import { promptStore } from "@/lib/prompts/prompt-store";
import { searchPrompts } from "@/lib/prompts/search";
import { usePrompts } from "@/lib/prompts/use-prompts";
import { cn } from "@/lib/utils";
import { PromptDetail } from "./prompt-detail";
import { type PromptFields, PromptForm } from "./prompt-form";

// The prompt library page (roadmap 3.6, decision 19): this browser's saved prompts, searchable by name,
// tag and text. Apply one to a chat from its Model settings.

const EMPTY: PromptFields = { name: "", tags: "", text: "" };

function PromptRow({
	prompt,
	selected,
	onSelect,
}: {
	prompt: Prompt;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<li>
			<button
				type="button"
				aria-current={selected || undefined}
				onClick={onSelect}
				className={cn(
					"flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left hover:bg-muted",
					selected && "bg-muted",
				)}
			>
				<span className="font-medium text-sm">{prompt.name}</span>
				<span className="line-clamp-2 text-muted-foreground text-xs">
					{currentVersion(prompt).text}
				</span>
				{prompt.tags.length > 0 && (
					<span className="flex flex-wrap gap-1">
						{prompt.tags.map((tag) => (
							<Badge key={tag} variant="secondary">
								{tag}
							</Badge>
						))}
					</span>
				)}
			</button>
		</li>
	);
}

function NewPrompt({
	onCreated,
	onCancel,
}: {
	onCreated: (id: string) => void;
	onCancel: () => void;
}) {
	const viewer = useViewer();
	const [failed, setFailed] = useState(false);
	const [busy, setBusy] = useState(false);
	const create = async (fields: PromptFields) => {
		setBusy(true);
		setFailed(false);
		try {
			const prompt = await promptStore().createPrompt({
				name: fields.name,
				tags: parseTags(fields.tags),
				text: fields.text,
				ownerId: viewer ?? null,
			});
			onCreated(prompt.id);
		} catch (error) {
			logError("Couldn't save the prompt:", error);
			setFailed(true);
		} finally {
			setBusy(false);
		}
	};
	return (
		<section
			aria-label="New prompt"
			className="flex flex-col gap-3 rounded-pane border bg-card p-4"
		>
			<h2 className="font-medium">New prompt</h2>
			{failed && (
				<p role="alert" className="text-destructive text-sm">
					Couldn't save the prompt. Try again.
				</p>
			)}
			<PromptForm
				initial={EMPTY}
				submitLabel="Save prompt"
				onSubmit={create}
				onCancel={onCancel}
				busy={busy || viewer === undefined}
			/>
		</section>
	);
}

export function PromptLibrary({
	initialPromptId,
	initialVersion,
}: {
	/** Opens this prompt (a link from a reply's details, roadmap 3.6b). */
	initialPromptId?: string;
	/** And shows this version of it in the history. */
	initialVersion?: number;
}) {
	const list = usePrompts();
	const [query, setQuery] = useState("");
	const [creating, setCreating] = useState(false);
	const [selectedId, setSelectedId] = useState(initialPromptId);

	const prompts = list.status === "ready" ? list.prompts : [];
	const shown = searchPrompts(prompts, query);
	const selected = prompts.find((prompt) => prompt.id === selectedId);

	return (
		<div className="grid gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between gap-2">
					<h1 className="font-semibold text-lg">Prompts</h1>
					<Button
						size="sm"
						variant="outline"
						onClick={() => {
							setCreating(true);
							setSelectedId(undefined);
						}}
					>
						<PlusIcon />
						New prompt
					</Button>
				</div>
				<Input
					type="search"
					aria-label="Search prompts"
					placeholder="Search name, text or #tag"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
				{list.status === "error" && (
					<p role="alert" className="text-destructive text-sm">
						Couldn't load your prompts from this browser.
					</p>
				)}
				{list.status === "ready" && shown.length === 0 && (
					<p className="text-muted-foreground text-sm">
						{prompts.length === 0
							? "Save prompts you reuse. They stay in this browser."
							: "No prompts match your search."}
					</p>
				)}
				<ul aria-label="Saved prompts" className="flex flex-col gap-1">
					{shown.map((prompt) => (
						<PromptRow
							key={prompt.id}
							prompt={prompt}
							selected={prompt.id === selectedId}
							onSelect={() => {
								setSelectedId(prompt.id);
								setCreating(false);
							}}
						/>
					))}
				</ul>
			</div>
			<div className="min-w-0">
				{creating ? (
					<NewPrompt
						onCreated={(id) => {
							setCreating(false);
							setSelectedId(id);
						}}
						onCancel={() => setCreating(false)}
					/>
				) : selected ? (
					<PromptDetail
						key={selected.id}
						prompt={selected}
						initialVersion={
							selected.id === initialPromptId ? initialVersion : undefined
						}
						onDeleted={() => setSelectedId(undefined)}
					/>
				) : (
					list.status === "ready" &&
					(selectedId !== undefined ? (
						<p className="text-muted-foreground text-sm">
							That prompt was deleted, or isn't in this browser.
						</p>
					) : (
						prompts.length > 0 && (
							<p className="text-muted-foreground text-sm">
								Pick a prompt to edit it or see its history.
							</p>
						)
					))
				)}
			</div>
		</div>
	);
}
