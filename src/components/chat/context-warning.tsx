import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { TriangleAlertIcon } from "lucide-react";
import { useChatPrefs } from "@/lib/chat/chat-prefs";
import { contextLevel, contextTokens } from "@/lib/chat/context-usage";
import { useChatMessagesValue } from "@/lib/chat/use-chat-messages-value";
import { formatTokens } from "@/lib/models/format";

// Under a chat's header (roadmap R2 S4), outside the composer (hard rule 8): a notice once the chat
// nears or passes the context length of its host or model. Static, so there's no motion to reduce.
// Settings → Chat turns it off.

const ADVICE = "Start a new chat, or pick a model with more context.";

export function ContextWarning({
	chat,
	contextLength,
}: {
	chat: Chat<UIMessage>;
	/** The pinned host's context length, else the model's; undefined when nobody says. */
	contextLength: number | undefined;
}) {
	const { contextWarnings } = useChatPrefs();
	const tokens = useChatMessagesValue(chat, contextTokens);
	const level = contextLevel(tokens, contextLength);
	if (!contextWarnings || tokens === null || !contextLength) return null;
	if (level !== "nearing" && level !== "over") return null;
	const limit = formatTokens(contextLength);
	const percent = Math.min(99, Math.floor((tokens / contextLength) * 100));
	const message =
		level === "over"
			? `This chat is past its ${limit} context, so replies may fail or forget the start.`
			: `This chat has used ${percent}% of its ${limit} context.`;
	return (
		<div
			role="status"
			data-context-warning={level}
			className="mx-3 my-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
		>
			<TriangleAlertIcon
				aria-hidden
				className="mt-0.5 size-4 shrink-0 text-warning"
			/>
			<span>
				{message} {ADVICE}
			</span>
		</div>
	);
}
