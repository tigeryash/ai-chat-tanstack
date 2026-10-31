import { z } from "@/lib/zod";
import { ChatStoreError, issuesOf } from "./errors";
import { chatIdSchema, ownerIdSchema } from "./format";

// A workspace (roadmap 3.1): several chats side by side, one per pane. The record only lists its panes
// (chat id, width, synced); each pane's messages, model and settings stay with its chat. Naming, saved
// layouts and deep links are roadmap 3.5. Workspaces have a format of their own, separate from chats',
// so adding them needed no chat migration. When the record's shape changes, bump
// WORKSPACE_FORMAT_VERSION and migrate in `readWorkspace`.

export const WORKSPACE_FORMAT_VERSION = 1;
export const MAX_PANES = 4;

export interface WorkspacePane {
	/** The pane's chat. Doubles as the pane's id. */
	chatId: string;
	/** Width as a percentage of the row (0–100). */
	size: number;
	/** Synced panes share one composer draft and send together (roadmap 3.2). */
	synced: boolean;
}

export interface Workspace {
	id: string;
	/** Like a chat's (roadmap 1.9): a Better Auth user ID, or null when made signed out. */
	ownerId: string | null;
	/** In order, left to right. At least one, at most MAX_PANES. */
	panes: WorkspacePane[];
	/** Milliseconds since the epoch. */
	createdAt: number;
	updatedAt: number;
}

/** What the sidebar needs: which chats a workspace folds into one entry. */
export interface WorkspaceSummary {
	id: string;
	ownerId: string | null;
	chatIds: string[];
	updatedAt: number;
}

const timestamp = z.number().int().nonnegative();

const paneSchema = z.object({
	chatId: chatIdSchema,
	size: z.number().min(0).max(100),
	synced: z.boolean(),
});

export const workspaceSchema = z.object({
	id: chatIdSchema,
	ownerId: ownerIdSchema,
	panes: z
		.array(paneSchema)
		.min(1)
		.max(MAX_PANES)
		.refine(
			(panes) =>
				new Set(panes.map((pane) => pane.chatId)).size === panes.length,
			"A chat is in two panes.",
		),
	createdAt: timestamp,
	updatedAt: timestamp,
});

/** A stored workspace, checked. Throws a ChatStoreError for a bad or newer record. */
export function readWorkspace(raw: unknown): Workspace {
	const version = (raw as { formatVersion?: unknown } | null)?.formatVersion;
	if (typeof version === "number" && version > WORKSPACE_FORMAT_VERSION) {
		throw new ChatStoreError(
			"too-new",
			"This workspace was saved by a newer version of the app.",
		);
	}
	const parsed = workspaceSchema.safeParse(raw);
	if (!parsed.success) {
		throw new ChatStoreError("invalid-chat", "A stored workspace is invalid.", {
			issues: issuesOf(parsed.error),
		});
	}
	return parsed.data;
}

export function toWorkspaceSummary(workspace: Workspace): WorkspaceSummary {
	return {
		id: workspace.id,
		ownerId: workspace.ownerId,
		chatIds: workspace.panes.map((pane) => pane.chatId),
		updatedAt: workspace.updatedAt,
	};
}
