import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	MoreHorizontalIcon,
	SquareIcon,
	XIcon,
} from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useChatStatus } from "@/lib/chat/use-chat-status";
import { logError } from "@/lib/log";

export interface PaneActionsProps {
	chat: Chat<UIMessage>;
	/** "Pane 2", for the controls' names. */
	label: string;
	synced: boolean;
	onSyncedChange: (synced: boolean) => void;
	/** Undefined when there's no room that way. */
	onMoveLeft?: () => void;
	onMoveRight?: () => void;
	/** Undefined for the last pane. */
	onClose?: () => void;
}

/**
 * A pane's own controls (roadmaps 3.1 and 3.2) at the end of its header: the Synced toggle, a Stop that
 * stops only this pane (decision 18), moving it, and closing it.
 */
export function PaneActions({
	chat,
	label,
	synced,
	onSyncedChange,
	onMoveLeft,
	onMoveRight,
	onClose,
}: PaneActionsProps) {
	const switchId = useId();
	const status = useChatStatus(chat);
	const busy = status === "submitted" || status === "streaming";

	return (
		<>
			<label
				htmlFor={switchId}
				title="Synced: typing and sending reach every synced pane"
				className="flex items-center gap-1.5 px-1 text-muted-foreground text-xs"
			>
				<Switch
					id={switchId}
					size="sm"
					checked={synced}
					onCheckedChange={onSyncedChange}
					aria-label={`Sync ${label}`}
				/>
				<span className="@md/header:inline hidden">Synced</span>
			</label>
			{busy && (
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={`Stop ${label}`}
					title="Stop this pane"
					onClick={() =>
						chat
							.stop()
							.catch((error) => logError("Couldn't stop the reply:", error))
					}
				>
					<SquareIcon />
				</Button>
			)}
			{(onMoveLeft || onMoveRight) && (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={`Options for ${label}`}
							/>
						}
					>
						<MoreHorizontalIcon />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem disabled={!onMoveLeft} onClick={onMoveLeft}>
							<ArrowLeftIcon />
							Move left
						</DropdownMenuItem>
						<DropdownMenuItem disabled={!onMoveRight} onClick={onMoveRight}>
							<ArrowRightIcon />
							Move right
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
			{onClose && (
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={`Close ${label}`}
					title="Close pane"
					onClick={onClose}
				>
					<XIcon />
				</Button>
			)}
		</>
	);
}
