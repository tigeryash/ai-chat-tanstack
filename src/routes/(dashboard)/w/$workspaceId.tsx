import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { WorkspaceView } from "@/components/workspaces/workspace-view";
import { currentViewer, useViewer } from "@/lib/account";
import { isVisibleTo } from "@/lib/storage/ownership";

// A multi-pane workspace stored in this browser (roadmap 3.1). Like a chat, it renders in the browser
// only, and another account's workspace is treated as missing (roadmap 1.9). The loader imports the
// chat engine with `import()`, since loaders aren't code-split (quality audit P1).
export const Route = createFileRoute("/(dashboard)/w/$workspaceId")({
	ssr: false,
	loader: async ({ params }) => {
		const [viewer, { openWorkspace }] = await Promise.all([
			currentViewer(),
			import("@/lib/workspaces/workspace-sessions"),
		]);
		const workspace = await openWorkspace(params.workspaceId, viewer);
		if (!workspace) throw notFound();
		return workspace;
	},
	// The view keeps its own copy once open, and saves every change; reloading data under it would
	// undo a change that's still saving.
	staleTime: Number.POSITIVE_INFINITY,
	component: RouteComponent,
});

function RouteComponent() {
	const workspace = Route.useLoaderData();
	const navigate = useNavigate();
	const viewer = useViewer();
	// After signing out, leave instead of showing a workspace this viewer can't see.
	const hidden = viewer !== undefined && !isVisibleTo(workspace, viewer);
	useEffect(() => {
		if (hidden) void navigate({ to: "/new", replace: true });
	}, [hidden, navigate]);

	if (hidden) return null;
	return <WorkspaceView key={workspace.id} initial={workspace} />;
}
