import { useNavigate } from "@tanstack/react-router";
import { Columns2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/log";
import { createWorkspaceFrom } from "@/lib/workspaces/workspace-sessions";

/** "Add pane" on a single chat (roadmap 3.1): makes a workspace with this chat and a new one beside it. */
export function AddPaneButton({
	chatId,
	ownerId,
}: {
	chatId: string;
	ownerId: string | null;
}) {
	const navigate = useNavigate();
	const [failed, setFailed] = useState(false);
	const addPane = async () => {
		setFailed(false);
		try {
			const workspaceId = await createWorkspaceFrom(chatId, ownerId);
			await navigate({ to: "/w/$workspaceId", params: { workspaceId } });
		} catch (error) {
			logError("Couldn't make the workspace:", error);
			setFailed(true);
		}
	};
	return (
		<>
			{failed && (
				<span role="alert" className="text-destructive text-xs">
					Couldn't add a pane.
				</span>
			)}
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label="Add pane"
				title="Add pane"
				onClick={addPane}
			>
				<Columns2Icon />
			</Button>
		</>
	);
}
