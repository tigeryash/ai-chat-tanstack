"use client";

import type { FileUIPart, UIMessage } from "ai";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	PaperclipIcon,
	XIcon,
} from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactElement } from "react";
import { createContext, memo, useContext, useEffect, useState } from "react";
import {
	SafeMarkdown,
	type SafeMarkdownProps,
} from "@/components/ai-elements/safe-markdown";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import {
	MessageContent as MessageBody,
	MessageFooter,
	Message as MessageRoot,
} from "@/components/ui/message";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// AI SDK Elements' Message, rebuilt on shadcn/ui's Message, Bubble and Tooltip (AI Elements "Message"
// pattern). The shadcn/ui parts are imported as MessageRoot and MessageBody, since this file keeps the
// AI SDK Elements export names.

const MessageFromContext = createContext<UIMessage["role"]>("assistant");

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
	from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
	<MessageFromContext.Provider value={from}>
		<MessageRoot
			align={from === "user" ? "end" : "start"}
			// Callers put the actions beside the content rather than in it, so stack them the way the
			// AI SDK Elements version did instead of shadcn/ui's row. Children stretch to full width on both
			// sides: the bubble's 80% cap is a percentage of its parent, so a shrink-to-fit parent (as with
			// `items-end`) squeezed every user message to 80% of its own text and wrapped it. The bubble and
			// footer align themselves to the end instead.
			className={cn("flex-col data-[align=end]:flex-col", className)}
			{...props}
		/>
	</MessageFromContext.Provider>
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
	children,
	className,
	...props
}: MessageContentProps) => {
	const from = useContext(MessageFromContext);

	return (
		<MessageBody className={className} {...props}>
			{from === "user" ? (
				<Bubble align="end" variant="muted">
					<BubbleContent>{children}</BubbleContent>
				</Bubble>
			) : (
				children
			)}
		</MessageBody>
	);
};

export type MessageActionsProps = ComponentProps<typeof MessageFooter>;

export const MessageActions = (props: MessageActionsProps) => (
	<MessageFooter {...props} />
);

export type MessageActionProps = ComponentProps<typeof Button> & {
	tooltip?: string;
	label?: string;
};

export const MessageAction = ({
	tooltip,
	children,
	label,
	variant = "ghost",
	size = "icon-sm",
	...props
}: MessageActionProps) => {
	const button = (
		<Button
			aria-label={label || tooltip}
			size={size}
			type="button"
			variant={variant}
			{...props}
		>
			{children}
		</Button>
	);

	if (tooltip) {
		return (
			<Tooltip>
				<TooltipTrigger render={button} />
				<TooltipContent>
					<p>{tooltip}</p>
				</TooltipContent>
			</Tooltip>
		);
	}

	return button;
};

type MessageBranchContextType = {
	currentBranch: number;
	totalBranches: number;
	goToPrevious: () => void;
	goToNext: () => void;
	branches: ReactElement[];
	setBranches: (branches: ReactElement[]) => void;
};

const MessageBranchContext = createContext<MessageBranchContextType | null>(
	null,
);

const useMessageBranch = () => {
	const context = useContext(MessageBranchContext);

	if (!context) {
		throw new Error(
			"MessageBranch components must be used within MessageBranch",
		);
	}

	return context;
};

export type MessageBranchProps = HTMLAttributes<HTMLDivElement> & {
	defaultBranch?: number;
	onBranchChange?: (branchIndex: number) => void;
};

export const MessageBranch = ({
	defaultBranch = 0,
	onBranchChange,
	className,
	...props
}: MessageBranchProps) => {
	const [currentBranch, setCurrentBranch] = useState(defaultBranch);
	const [branches, setBranches] = useState<ReactElement[]>([]);

	const handleBranchChange = (newBranch: number) => {
		setCurrentBranch(newBranch);
		onBranchChange?.(newBranch);
	};

	const goToPrevious = () => {
		const newBranch =
			currentBranch > 0 ? currentBranch - 1 : branches.length - 1;
		handleBranchChange(newBranch);
	};

	const goToNext = () => {
		const newBranch =
			currentBranch < branches.length - 1 ? currentBranch + 1 : 0;
		handleBranchChange(newBranch);
	};

	const contextValue: MessageBranchContextType = {
		currentBranch,
		totalBranches: branches.length,
		goToPrevious,
		goToNext,
		branches,
		setBranches,
	};

	return (
		<MessageBranchContext.Provider value={contextValue}>
			<div
				className={cn("grid w-full gap-2 [&>div]:pb-0", className)}
				{...props}
			/>
		</MessageBranchContext.Provider>
	);
};

export type MessageBranchContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageBranchContent = ({
	children,
	...props
}: MessageBranchContentProps) => {
	const { currentBranch, setBranches, branches } = useMessageBranch();
	const childrenArray = Array.isArray(children) ? children : [children];

	// Use useEffect to update branches when they change
	useEffect(() => {
		if (branches.length !== childrenArray.length) {
			setBranches(childrenArray);
		}
	}, [childrenArray, branches, setBranches]);

	return childrenArray.map((branch, index) => (
		<div
			className={cn(
				"grid gap-2 overflow-hidden [&>div]:pb-0",
				index === currentBranch ? "block" : "hidden",
			)}
			key={branch.key}
			{...props}
		>
			{branch}
		</div>
	));
};

export type MessageBranchSelectorProps = HTMLAttributes<HTMLDivElement> & {
	from: UIMessage["role"];
};

export const MessageBranchSelector = ({
	className,
	from,
	...props
}: MessageBranchSelectorProps) => {
	const { totalBranches } = useMessageBranch();

	// Don't render if there's only one branch
	if (totalBranches <= 1) {
		return null;
	}

	return (
		<ButtonGroup
			className="[&>*:not(:first-child)]:rounded-l-md [&>*:not(:last-child)]:rounded-r-md"
			orientation="horizontal"
			{...props}
		/>
	);
};

export type MessageBranchPreviousProps = ComponentProps<typeof Button>;

export const MessageBranchPrevious = ({
	children,
	...props
}: MessageBranchPreviousProps) => {
	const { goToPrevious, totalBranches } = useMessageBranch();

	return (
		<Button
			aria-label="Previous branch"
			disabled={totalBranches <= 1}
			onClick={goToPrevious}
			size="icon-sm"
			type="button"
			variant="ghost"
			{...props}
		>
			{children ?? <ChevronLeftIcon size={14} />}
		</Button>
	);
};

export type MessageBranchNextProps = ComponentProps<typeof Button>;

export const MessageBranchNext = ({
	children,
	className,
	...props
}: MessageBranchNextProps) => {
	const { goToNext, totalBranches } = useMessageBranch();

	return (
		<Button
			aria-label="Next branch"
			disabled={totalBranches <= 1}
			onClick={goToNext}
			size="icon-sm"
			type="button"
			variant="ghost"
			{...props}
		>
			{children ?? <ChevronRightIcon size={14} />}
		</Button>
	);
};

export type MessageBranchPageProps = HTMLAttributes<HTMLSpanElement>;

export const MessageBranchPage = ({
	className,
	...props
}: MessageBranchPageProps) => {
	const { currentBranch, totalBranches } = useMessageBranch();

	return (
		<ButtonGroupText
			className={cn(
				"border-none bg-transparent text-muted-foreground shadow-none",
				className,
			)}
			{...props}
		>
			{currentBranch + 1} of {totalBranches}
		</ButtonGroupText>
	);
};

// Model output: hardened markdown only (safe-markdown.tsx).
export type MessageResponseProps = SafeMarkdownProps;

export const MessageResponse = memo(
	({ className, ...props }: MessageResponseProps) => (
		<SafeMarkdown
			className={cn(
				"size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
				className,
			)}
			{...props}
		/>
	),
	(prevProps, nextProps) => prevProps.children === nextProps.children,
);

MessageResponse.displayName = "MessageResponse";

export type MessageAttachmentProps = HTMLAttributes<HTMLDivElement> & {
	data: FileUIPart;
	className?: string;
	onRemove?: () => void;
};

export function MessageAttachment({
	data,
	className,
	onRemove,
	...props
}: MessageAttachmentProps) {
	const filename = data.filename || "";
	const mediaType =
		data.mediaType?.startsWith("image/") && data.url ? "image" : "file";
	const isImage = mediaType === "image";
	const attachmentLabel = filename || (isImage ? "Image" : "Attachment");

	return (
		<div
			className={cn(
				"group relative size-24 overflow-hidden rounded-lg",
				className,
			)}
			{...props}
		>
			{isImage ? (
				<>
					<img
						alt={filename || "attachment"}
						className="size-full object-cover"
						height={100}
						src={data.url}
						width={100}
					/>
					{onRemove && (
						<Button
							aria-label="Remove attachment"
							className="absolute top-2 right-2 size-6 rounded-full bg-background/80 p-0 opacity-0 backdrop-blur-sm transition-opacity hover:bg-background group-hover:opacity-100 [&>svg]:size-3"
							onClick={(e) => {
								e.stopPropagation();
								onRemove();
							}}
							type="button"
							variant="ghost"
						>
							<XIcon />
							<span className="sr-only">Remove</span>
						</Button>
					)}
				</>
			) : (
				<>
					<Tooltip>
						<TooltipTrigger
							render={
								<div className="flex size-full shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
									<PaperclipIcon className="size-4" />
								</div>
							}
						/>
						<TooltipContent>
							<p>{attachmentLabel}</p>
						</TooltipContent>
					</Tooltip>
					{onRemove && (
						<Button
							aria-label="Remove attachment"
							className="size-6 shrink-0 rounded-full p-0 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 [&>svg]:size-3"
							onClick={(e) => {
								e.stopPropagation();
								onRemove();
							}}
							type="button"
							variant="ghost"
						>
							<XIcon />
							<span className="sr-only">Remove</span>
						</Button>
					)}
				</>
			)}
		</div>
	);
}

export type MessageAttachmentsProps = ComponentProps<"div">;

export function MessageAttachments({
	children,
	className,
	...props
}: MessageAttachmentsProps) {
	if (!children) {
		return null;
	}

	return (
		<div
			className={cn(
				"ml-auto flex w-fit flex-wrap items-start gap-2",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export type MessageToolbarProps = ComponentProps<"div">;

export const MessageToolbar = ({
	className,
	children,
	...props
}: MessageToolbarProps) => (
	<div
		className={cn(
			"mt-4 flex w-full items-center justify-between gap-4",
			className,
		)}
		{...props}
	>
		{children}
	</div>
);
