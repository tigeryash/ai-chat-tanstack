import { createFileRoute } from "@tanstack/react-router";
import { PromptLibrary } from "@/components/prompts/prompt-library";
import { z } from "@/lib/zod";

// The prompt library (roadmap 3.6). Client-only like the rest of the dashboard: prompts live in this
// browser's IndexedDB. `?prompt=<id>&version=<n>` opens a prompt at a version (a reply's "⋯" links
// there, roadmap 3.6b); bad values are dropped, not errors.
const searchSchema = z.object({
	prompt: z.string().min(1).max(256).optional().catch(undefined),
	version: z.coerce.number().int().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/(dashboard)/prompts")({
	ssr: false,
	validateSearch: searchSchema,
	component: PromptsPage,
});

function PromptsPage() {
	const { prompt, version } = Route.useSearch();
	return (
		<div className="h-full overflow-y-auto rounded-pane border bg-card text-card-foreground">
			<div className="mx-auto max-w-5xl px-6 py-10">
				<PromptLibrary
					// A new link opens fresh, even when the page is already showing.
					key={`${prompt ?? ""}:${version ?? ""}`}
					initialPromptId={prompt}
					initialVersion={version}
				/>
			</div>
		</div>
	);
}
