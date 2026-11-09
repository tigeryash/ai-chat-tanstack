import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChatPlaceholder } from "@/components/chat/chat-placeholder";
import { NewChat } from "@/components/chat/new-chat";
import { autoChoiceFor } from "@/components/models/use-chat-model";
import { logError } from "@/lib/log";
import { type CatalogModel, useModelCatalog } from "@/lib/models/catalog";
import { resolveModelLink } from "@/lib/workspaces/model-link";
import { createWorkspaceWith } from "@/lib/workspaces/workspace-sessions";

// `/new?models=a,b,c` (roadmap 3.5): waits for the catalog, then opens a workspace with a pane per
// model the catalog lists (Auto picks each one's host, so a model the user can't run yet opens and
// says which key it needs). One model opens a plain new chat on it. Ids the catalog doesn't list are
// left out, and the page says how many.

const CATALOG_FAILED =
	"Couldn't load the model catalog, so the link's models didn't open.";
const NONE_FOUND = "None of the link's models are in the catalog.";

function missingNotice(count: number): string | undefined {
	if (count === 0) return undefined;
	return count === 1
		? "1 model from the link isn't in the catalog."
		: `${count} models from the link aren't in the catalog.`;
}

export function ModelLinkChat({
	ids,
	ownerId,
}: {
	ids: readonly string[];
	ownerId: string | null;
}) {
	const catalog = useModelCatalog();
	if (catalog.isPending) {
		return <ChatPlaceholder>Opening the link's models…</ChatPlaceholder>;
	}
	if (catalog.isError) {
		return <NewChat ownerId={ownerId} notice={CATALOG_FAILED} />;
	}
	const { found, missing } = resolveModelLink(ids, catalog.data.models);
	if (found.length >= 2) {
		return (
			<LinkWorkspace found={found} missing={missing.length} ownerId={ownerId} />
		);
	}
	const [only] = found;
	return (
		<NewChat
			ownerId={ownerId}
			model={only ? autoChoiceFor(only) : undefined}
			notice={only ? missingNotice(missing.length) : NONE_FOUND}
		/>
	);
}

/** Makes the workspace once, then replaces the link with it, so Back doesn't make another. */
function LinkWorkspace({
	found,
	missing,
	ownerId,
}: {
	found: readonly CatalogModel[];
	missing: number;
	ownerId: string | null;
}) {
	const navigate = useNavigate();
	const started = useRef(false);
	const [failed, setFailed] = useState(false);
	useEffect(() => {
		if (started.current) return;
		started.current = true;
		const seeds = found.map((model) => ({ model: autoChoiceFor(model) }));
		createWorkspaceWith(seeds, ownerId)
			.then((workspaceId) =>
				navigate({
					to: "/w/$workspaceId",
					params: { workspaceId },
					search: missing > 0 ? { missing } : {},
					replace: true,
				}),
			)
			.catch((error) => {
				logError("Couldn't open the link's models:", error);
				setFailed(true);
			});
	}, [found, missing, ownerId, navigate]);
	return (
		<ChatPlaceholder>
			{failed
				? "Couldn't open the link's models. Try reloading the page."
				: "Opening the link's models…"}
		</ChatPlaceholder>
	);
}
