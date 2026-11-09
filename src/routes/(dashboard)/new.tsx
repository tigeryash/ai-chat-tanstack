import { createFileRoute } from "@tanstack/react-router";
import { NewChat } from "@/components/chat/new-chat";
import { ModelLinkChat } from "@/components/workspaces/model-link-chat";
import { useViewer } from "@/lib/account";
import {
	modelLinkSearchSchema,
	parseModelLink,
} from "@/lib/workspaces/model-link";

// A new local chat, or with `?models=a,b,c` a deep link to those catalog models side by side (roadmap
// 3.5). `validateSearch` isn't code-split, so the schema's module imports only Zod.
export const Route = createFileRoute("/(dashboard)/new")({
	ssr: false,
	validateSearch: modelLinkSearchSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const viewer = useViewer();
	const { models } = Route.useSearch();
	if (viewer === undefined) return null;
	const ids = parseModelLink(models);
	// The chat belongs to whoever is signed in (roadmap 1.9), so signing in or out here starts a new one.
	const key = `${viewer ?? ""}|${ids.join(",")}`;
	return ids.length > 0 ? (
		<ModelLinkChat key={key} ids={ids} ownerId={viewer} />
	) : (
		<NewChat key={key} ownerId={viewer} />
	);
}
