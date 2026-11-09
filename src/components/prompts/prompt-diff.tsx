import { diffLines, diffStats } from "@/lib/prompts/diff";
import { cn } from "@/lib/utils";

// A line diff between two versions of a prompt (roadmap 3.6). Each line says what happened in text
// ("+", "−") as well as color, so it reads without color too.

const KIND = {
	same: { mark: " ", label: "Unchanged", className: "" },
	added: { mark: "+", label: "Added", className: "bg-success/15" },
	removed: {
		mark: "−",
		label: "Removed",
		className: "bg-destructive/15 text-muted-foreground",
	},
} as const;

export function PromptDiff({
	before,
	after,
	label,
}: {
	before: string;
	after: string;
	label: string;
}) {
	const lines = diffLines(before, after);
	const { added, removed } = diffStats(lines);
	return (
		<figure className="flex flex-col gap-1.5">
			<figcaption className="text-muted-foreground text-xs">
				{label}: {added} added, {removed} removed
			</figcaption>
			<ol
				aria-label={label}
				className="overflow-x-auto rounded-md border font-mono text-xs"
			>
				{lines.map((line, index) => {
					const kind = KIND[line.kind];
					return (
						<li
							// Lines repeat and never reorder, so the index is the line's identity.
							// biome-ignore lint/suspicious/noArrayIndexKey: see above.
							key={index}
							data-diff={line.kind}
							className={cn("flex gap-2 px-2 py-0.5", kind.className)}
						>
							<span aria-hidden className="select-none">
								{kind.mark}
							</span>
							<span className="sr-only">{kind.label}: </span>
							<span className="whitespace-pre-wrap break-words">
								{line.text || " "}
							</span>
						</li>
					);
				})}
			</ol>
		</figure>
	);
}
