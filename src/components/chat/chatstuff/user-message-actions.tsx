import { ChevronLeftIcon, ChevronRightIcon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { Action, Actions } from "@/components/ai-elements/actions";
import { Button } from "@/components/ui/button";
import { MAX_EDIT_LENGTH } from "@/lib/chat/branching";
import { cn } from "@/lib/utils";

// Edit and branch (roadmap 1.7), on the person's own messages: Edit opens the message in place (never
// the composer, hard rule 8), and "‹ 2/3 ›" switches between its versions. Neither adds height to a
// message that was never edited (the pencil is overlaid beside the bubble). Both hide while the chat's
// reply streams (`data-chat-status` on the pane), by CSS, so a reply starting or ending doesn't
// re-render the person's messages.

export interface UserMessageBranching {
	/** Sends the edited text as a new version. Unset when the chat has no model; ignored while busy. */
	onEdit?: (text: string) => void;
	/** This message's versions, oldest first, when it has more than one. */
	versionIds?: readonly string[];
	/** Shows another version. Ignored while the chat is busy. */
	onSwitch?: (versionId: string) => void;
}

export function textOf(parts: readonly { type: string; text?: string }[]) {
	return parts
		.flatMap((part) => (part.type === "text" ? [part.text ?? ""] : []))
		.join("\n\n");
}

export function VersionSwitcher({
	messageId,
	versionIds,
	onSwitch,
	label = "Message versions",
}: {
	messageId: string;
	versionIds: readonly string[];
	onSwitch?: (versionId: string) => void;
	label?: string;
}) {
	const index = versionIds.indexOf(messageId);
	const go = (step: number) => {
		const target = versionIds[index + step];
		if (target) onSwitch?.(target);
	};
	return (
		// biome-ignore lint/a11y/useSemanticElements: a toolbar of two buttons, not a form fieldset.
		<div
			role="group"
			aria-label={label}
			className="flex items-center"
			data-slot="message-versions"
		>
			<Button
				aria-label="Previous version"
				disabled={!onSwitch || index <= 0}
				onClick={() => go(-1)}
				size="icon-sm"
				type="button"
				variant="ghost"
			>
				<ChevronLeftIcon className="size-4" />
			</Button>
			<span className="min-w-8 text-center tabular-nums">
				{index + 1}/{versionIds.length}
			</span>
			<Button
				aria-label="Next version"
				disabled={!onSwitch || index >= versionIds.length - 1}
				onClick={() => go(1)}
				size="icon-sm"
				type="button"
				variant="ghost"
			>
				<ChevronRightIcon className="size-4" />
			</Button>
		</div>
	);
}

/** Hidden while the chat's reply streams (`data-chat-status` on the pane), by CSS: see the header. */
export const HIDE_WHILE_BUSY =
	"in-data-[chat-status=streaming]:invisible in-data-[chat-status=submitted]:invisible";

function EditAction({
	onStartEdit,
	className,
}: {
	onStartEdit: () => void;
	className?: string;
}) {
	return (
		<Action
			onClick={onStartEdit}
			tooltip="Edit message"
			// Shown on hover or keyboard focus, and always where there's no hover (touch).
			className={cn(
				"opacity-0 focus-visible:opacity-100 group-hover/message:opacity-100 [@media(hover:none)]:opacity-100",
				HIDE_WHILE_BUSY,
				className,
			)}
		>
			<PencilIcon className="size-4" />
		</Action>
	);
}

/**
 * Goes inside the bubble's box (`MessageContent`'s `bubbleAside`). A message with one version gets
 * only the pencil, overlaid to the bubble's left, so it adds no height between the message and its
 * reply. A message with versions gets the row below instead.
 */
export function UserMessageEditOverlay({
	onStartEdit,
	versionIds,
}: {
	onStartEdit?: () => void;
	versionIds?: readonly string[];
}) {
	if (!onStartEdit || versionIds) return null;
	return (
		<EditAction
			onStartEdit={onStartEdit}
			className="absolute top-1/2 right-full mr-1 -translate-y-1/2"
		/>
	);
}

/** Under a message with more than one version: the switcher, and Edit beside it. */
export function UserMessageActions({
	messageId,
	onStartEdit,
	versionIds,
	onSwitch,
}: {
	messageId: string;
	onStartEdit?: () => void;
} & Omit<UserMessageBranching, "onEdit">) {
	if (!versionIds) return null;
	return (
		<Actions className={HIDE_WHILE_BUSY}>
			<VersionSwitcher
				messageId={messageId}
				versionIds={versionIds}
				onSwitch={onSwitch}
			/>
			{onStartEdit && <EditAction onStartEdit={onStartEdit} />}
		</Actions>
	);
}

/** The message's text in a box, with Cancel and Send. Enter sends, Shift+Enter is a new line. */
export function EditMessageForm({
	initialText,
	onSubmit,
	onCancel,
}: {
	initialText: string;
	onSubmit: (text: string) => void;
	onCancel: () => void;
}) {
	const [text, setText] = useState(initialText);
	const empty = text.trim() === "";
	const submit = () => {
		if (!empty) onSubmit(text);
	};
	return (
		<form
			className="flex w-full flex-col gap-2 rounded-md border bg-muted p-2"
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<textarea
				aria-label="Edit message"
				// biome-ignore lint/a11y/noAutofocus: the person just asked to edit this message.
				autoFocus
				className="field-sizing-content max-h-80 min-h-16 w-full resize-none rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
				maxLength={MAX_EDIT_LENGTH}
				value={text}
				onChange={(event) => setText(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Escape") onCancel();
					if (
						event.key === "Enter" &&
						!event.shiftKey &&
						!event.nativeEvent.isComposing
					) {
						event.preventDefault();
						submit();
					}
				}}
			/>
			<div className="flex justify-end gap-2">
				<Button type="button" size="sm" variant="ghost" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit" size="sm" disabled={empty}>
					Send
				</Button>
			</div>
		</form>
	);
}
