"use client";

import type { ComponentProps } from "react";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { cn } from "@/lib/utils";

// AI SDK Elements' Conversation, rebuilt on shadcn/ui's Message Scroller (AI Elements "Chat" pattern).
// Wrap each message in a `MessageScrollerItem` with its id, and set `scrollAnchor` on the person's.

export type ConversationProps = ComponentProps<typeof MessageScroller>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
	<MessageScrollerProvider autoScroll>
		<MessageScroller
			className={cn("relative flex-1", className)}
			role="log"
			{...props}
		/>
	</MessageScrollerProvider>
);

export type ConversationContentProps = ComponentProps<
	typeof MessageScrollerContent
>;

export const ConversationContent = ({
	className,
	...props
}: ConversationContentProps) => (
	<MessageScrollerViewport>
		<MessageScrollerContent
			className={cn("flex flex-col gap-8 p-4", className)}
			{...props}
		/>
	</MessageScrollerViewport>
);

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
	title?: string;
	description?: string;
	icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
	className,
	title = "No messages yet",
	description = "Start a conversation to see messages here",
	icon,
	children,
	...props
}: ConversationEmptyStateProps) => (
	<div
		className={cn(
			"flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
			className,
		)}
		{...props}
	>
		{children ?? (
			<>
				{icon && <div className="text-muted-foreground">{icon}</div>}
				<div className="space-y-1">
					<h3 className="font-medium text-sm">{title}</h3>
					{description && (
						<p className="text-muted-foreground text-sm">{description}</p>
					)}
				</div>
			</>
		)}
	</div>
);

export type ConversationScrollButtonProps = ComponentProps<
	typeof MessageScrollerButton
>;

export const ConversationScrollButton = (
	props: ConversationScrollButtonProps,
) => <MessageScrollerButton {...props} />;
