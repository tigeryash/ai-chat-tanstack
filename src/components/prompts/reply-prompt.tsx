import { Link } from "@tanstack/react-router";
import type { PromptSource } from "@/lib/prompts/provenance";
import { usePrompts } from "@/lib/prompts/use-prompts";

// Which saved prompt produced a reply (roadmap 3.6b), as a row in the reply's "⋯" details: the prompt's
// name and version, linking to that version on the prompts page. A prompt deleted since (or hidden
// from this account) shows only its version.

export function ReplyPromptRow({ source }: { source: PromptSource }) {
	const list = usePrompts();
	const prompt =
		list.status === "ready"
			? list.prompts.find((entry) => entry.id === source.promptId)
			: undefined;
	const label = `version ${source.version}`;
	return (
		<div data-reply-detail className="contents">
			<dt className="text-muted-foreground">Prompt</dt>
			<dd className="break-all">
				{prompt ? (
					<Link
						to="/prompts"
						search={{ prompt: prompt.id, version: source.version }}
						className="underline underline-offset-2 hover:text-foreground"
					>
						{prompt.name}, {label}
					</Link>
				) : (
					<span className="text-muted-foreground">
						{list.status === "ready" ? `A deleted prompt, ${label}` : label}
					</span>
				)}
			</dd>
		</div>
	);
}
