import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useEffect } from "react";
import {
	autoChoiceFor,
	type ChatModel,
} from "@/components/models/use-chat-model";
import type { ChatParams } from "@/components/params/use-chat-params";
import { useAddPaneToChat } from "@/components/workspaces/add-pane-button";
import { regenerateReply } from "@/lib/chat/branching";
import type { ModelChoice } from "@/lib/chat/model-selection";
import { lastReply, replyText } from "@/lib/chat/reply-text";
import { chatRequestOptions } from "@/lib/chat/request-options";
import { useChatMessagesValue } from "@/lib/chat/use-chat-messages-value";
import { useChatStatus } from "@/lib/chat/use-chat-status";
import { logError } from "@/lib/log";
import { applyPrompt } from "@/lib/prompts/apply";
import {
	type PaneControls,
	registerPane,
	unregisterPane,
} from "@/lib/workspaces/focused-pane";

// Registers a chat screen's controls for the palette's pane actions and S6's shortcuts (roadmap R2
// S7, `lib/workspaces/focused-pane.ts`). Every control calls what the screen's own button calls.

/** What a workspace adds to a pane's controls. A single chat is "Pane 1", and Add pane makes a workspace. */
export type WorkspacePaneControls = Pick<
	PaneControls,
	"index" | "label" | "synced" | "setSynced" | "addPane" | "removePane"
>;

const lastReplyId = (messages: readonly UIMessage[]) => lastReply(messages)?.id;

export function usePaneControls({
	chat,
	model,
	params,
	pickModel,
	openModelSettings,
	workspace,
}: {
	chat: Chat<UIMessage>;
	model: ChatModel;
	params: ChatParams;
	/** The model picker's pick (tracked like a pick there). */
	pickModel: (choice: ModelChoice) => void;
	openModelSettings: (() => void) | undefined;
	workspace: WorkspacePaneControls | undefined;
}): void {
	const status = useChatStatus(chat);
	const busy = status === "submitted" || status === "streaming";
	const replyId = useChatMessagesValue(chat, lastReplyId);
	const single = useAddPaneToChat(chat.id);
	const options = chatRequestOptions(model.selection, params.request);

	const controls: PaneControls = {
		chatId: chat.id,
		index: workspace?.index ?? 0,
		label: workspace?.label ?? "Pane 1",
		busy,
		model: {
			choice: model.choice,
			wanted: model.wanted,
			catalog: model.catalog.models ?? [],
			connected: model.connected,
			hosts: model.hosts,
			pick: pickModel,
			pickCatalogModel: (catalogModel) =>
				pickModel(autoChoiceFor(catalogModel)),
			setChoice: model.setChoice,
		},
		stop: () => {
			chat.stop().catch((error) => logError("Couldn't stop the reply:", error));
		},
		lastReplyText:
			replyId === undefined
				? undefined
				: () => {
						const reply = lastReply(chat.messages);
						return reply ? replyText(reply) : "";
					},
		regenerate:
			busy || !options || replyId === undefined
				? undefined
				: () => {
						regenerateReply(chat, replyId, options).catch((error: unknown) =>
							logError(
								"Chat request failed:",
								error instanceof Error ? error.name : error,
							),
						);
					},
		openModelSettings,
		applyPrompt: (prompt) =>
			params.update(applyPrompt(params.settings, prompt)),
		synced: workspace?.synced,
		setSynced: workspace?.setSynced,
		addPane: workspace
			? workspace.addPane
			: () => {
					void single.add();
				},
		removePane: workspace?.removePane,
	};

	// Every render: the controls close over this render's model, settings and status.
	useEffect(() => registerPane(controls));
	useEffect(() => () => unregisterPane(chat.id), [chat.id]);
}
