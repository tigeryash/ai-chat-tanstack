import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { TriangleAlertIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChatPrefs } from "@/lib/chat/chat-prefs";
import {
	closeContextNotice,
	useClosedContextNotice,
} from "@/lib/chat/context-notices";
import {
	contextLevel,
	contextPercent,
	contextTokens,
	showsContextNotice,
} from "@/lib/chat/context-usage";
import { useChatMessagesValue } from "@/lib/chat/use-chat-messages-value";
import { formatTokens } from "@/lib/models/format";
import { cn } from "@/lib/utils";

// How full a chat's context is (roadmap R2 S4), outside the composer (hard rule 8): a ring in the
// header, always shown when the context length is known, and a closable notice under the header from
// 80% on (Settings → Chat turns the notice off). The ring's fill changes with a CSS transition, which
// the reduced-motion block in styles.css makes instant.

interface ContextProps {
	chat: Chat<UIMessage>;
	/** The pinned host's context length, else the model's; undefined when nobody says or it's local. */
	contextLength: number | undefined;
}

function useChatContext({ chat, contextLength }: ContextProps) {
	const tokens = useChatMessagesValue(chat, contextTokens);
	const level = contextLevel(tokens, contextLength);
	if (level === null || tokens === null || !contextLength) return null;
	return {
		level,
		percent: contextPercent(tokens, contextLength),
		limit: formatTokens(contextLength),
	};
}

/** The ring's radius, in a 16-unit box. */
const RING_RADIUS = 6;

export function ContextRing(props: ContextProps) {
	const context = useChatContext(props);
	if (!context) return null;
	const { level, percent, limit } = context;
	const label = `${percent}% of ${limit} context used`;
	return (
		<Tooltip>
			<TooltipTrigger
				aria-label={label}
				data-context-ring={level}
				className={cn(
					"flex shrink-0 items-center rounded p-0.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
					level === "under" ? "text-muted-foreground" : "text-warning",
				)}
			>
				<svg aria-hidden viewBox="0 0 16 16" className="-rotate-90 size-4">
					<circle
						cx="8"
						cy="8"
						r={RING_RADIUS}
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						className="opacity-25"
					/>
					<circle
						cx="8"
						cy="8"
						r={RING_RADIUS}
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						pathLength={100}
						strokeDasharray="100"
						strokeDashoffset={100 - Math.min(100, percent)}
						className="transition-[stroke-dashoffset] duration-300"
					/>
				</svg>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

const ADVICE = "Start a new chat, or pick a model with more context.";

export function ContextNotice(props: ContextProps) {
	const { contextWarnings } = useChatPrefs();
	const closedAt = useClosedContextNotice(props.chat.id);
	const context = useChatContext(props);
	if (!contextWarnings || !context) return null;
	const { level, percent, limit } = context;
	if (level === "under" || !showsContextNotice(level, closedAt)) return null;
	const message =
		level === "over"
			? `This chat is past its ${limit} context, so replies may fail or forget the start.`
			: `This chat has used ${Math.min(99, percent)}% of its ${limit} context.`;
	return (
		<div
			role="status"
			data-context-warning={level}
			className="mx-3 my-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 py-2 pr-1.5 pl-3 text-sm"
		>
			<TriangleAlertIcon
				aria-hidden
				className="mt-0.5 size-4 shrink-0 text-warning"
			/>
			<span className="flex-1">
				{message} {ADVICE}
			</span>
			<Button
				size="icon-xs"
				variant="ghost"
				aria-label="Close context notice"
				onClick={() => closeContextNotice(props.chat.id, level)}
			>
				<XIcon aria-hidden />
			</Button>
		</div>
	);
}
