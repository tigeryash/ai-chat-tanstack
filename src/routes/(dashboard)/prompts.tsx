import { createFileRoute } from "@tanstack/react-router";
import { PromptLibrary } from "@/components/prompts/prompt-library";

// The prompt library (roadmap 3.6). Client-only like the rest of the dashboard: prompts live in this
// browser's IndexedDB.
export const Route = createFileRoute("/(dashboard)/prompts")({
	ssr: false,
	component: PromptsPage,
});

function PromptsPage() {
	return (
		<div className="h-full overflow-y-auto rounded-pane border bg-card text-card-foreground">
			<div className="mx-auto max-w-5xl px-6 py-10">
				<PromptLibrary />
			</div>
		</div>
	);
}
