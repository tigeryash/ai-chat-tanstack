"use client";

import { BrainIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import {
	createContext,
	memo,
	useContext,
	useEffect,
	useEffectEvent,
	useState,
} from "react";
import { SafeMarkdown } from "@/components/ai-elements/safe-markdown";
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceIcon,
	TraceLine,
	TraceTitle,
} from "@/components/ui/trace";
import { cn } from "@/lib/utils";

// AI SDK Elements' Reasoning, rebuilt on shadcn/ui's Trace (AI Elements "Reasoning" pattern). While
// it streams, the line's title shimmers (`status="running"`); the shimmer utility stands still under
// reduced motion.

type ReasoningContextValue = {
	isStreaming: boolean;
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	duration: number | undefined;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export const useReasoning = () => {
	const context = useContext(ReasoningContext);
	if (!context) {
		throw new Error("Reasoning components must be used within Reasoning");
	}
	return context;
};

export type ReasoningProps = Omit<
	ComponentProps<typeof TraceCollapsible>,
	"open" | "onOpenChange"
> & {
	isStreaming?: boolean;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	duration?: number;
};

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;

export const Reasoning = memo(
	({
		className,
		isStreaming = false,
		open,
		defaultOpen = true,
		onOpenChange,
		duration: durationProp,
		children,
		...props
	}: ReasoningProps) => {
		// Only a reasoning that is still streaming when it first renders opens itself. One that's already
		// finished (a saved chat, after a reload) starts closed, so it never flashes open and shut.
		const [uncontrolledOpen, setUncontrolledOpen] = useState(
			defaultOpen && isStreaming,
		);
		const isOpen = open ?? uncontrolledOpen;
		const setIsOpen = (next: boolean) => {
			if (open === undefined) setUncontrolledOpen(next);
			onOpenChange?.(next);
		};

		const [measuredDuration, setMeasuredDuration] = useState<number>();
		const duration = durationProp ?? measuredDuration;
		const [startTime, setStartTime] = useState<number | null>(null);
		// Set once it has closed itself or the person opened or closed it; after that their choice wins.
		const [settled, setSettled] = useState(!isStreaming);

		// Track duration when streaming starts and ends
		useEffect(() => {
			if (isStreaming) {
				if (startTime === null) {
					setStartTime(Date.now());
				}
			} else if (startTime !== null) {
				setMeasuredDuration(Math.ceil((Date.now() - startTime) / MS_IN_S));
				setStartTime(null);
			}
		}, [isStreaming, startTime]);

		// An effect event, so a new `onOpenChange` each render doesn't restart the timer.
		const autoClose = useEffectEvent(() => {
			setIsOpen(false);
			setSettled(true);
		});

		// Open while it streams, close shortly after it finishes (once), unless the person chose.
		useEffect(() => {
			if (defaultOpen && !isStreaming && isOpen && !settled) {
				// Add a small delay before closing to allow user to see the content
				const timer = setTimeout(autoClose, AUTO_CLOSE_DELAY);

				return () => clearTimeout(timer);
			}
		}, [isStreaming, isOpen, defaultOpen, settled]);

		const handleOpenChange = (newOpen: boolean) => {
			setSettled(true);
			setIsOpen(newOpen);
		};

		return (
			<ReasoningContext.Provider
				value={{ isStreaming, isOpen, setIsOpen, duration }}
			>
				<Trace className={cn("not-prose mb-4", className)}>
					<TraceCollapsible
						onOpenChange={handleOpenChange}
						open={isOpen}
						{...props}
					>
						{children}
					</TraceCollapsible>
				</Trace>
			</ReasoningContext.Provider>
		);
	},
);

export type ReasoningTriggerProps = ComponentProps<
	typeof TraceCollapsibleTrigger
> & {
	getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode;
};

const defaultGetThinkingMessage = (isStreaming: boolean, duration?: number) => {
	if (isStreaming || duration === 0) {
		return "Thinking...";
	}
	if (duration === undefined) {
		return "Thought for a few seconds";
	}
	return `Thought for ${duration} seconds`;
};

export const ReasoningTrigger = memo(
	({
		className,
		children,
		getThinkingMessage = defaultGetThinkingMessage,
		...props
	}: ReasoningTriggerProps) => {
		const { isStreaming, duration } = useReasoning();

		return (
			<TraceCollapsibleTrigger className={className} {...props}>
				{children ?? (
					<TraceLine status={isStreaming ? "running" : undefined}>
						<TraceIcon>
							<BrainIcon />
						</TraceIcon>
						<TraceTitle>{getThinkingMessage(isStreaming, duration)}</TraceTitle>
					</TraceLine>
				)}
			</TraceCollapsibleTrigger>
		);
	},
);

export type ReasoningContentProps = ComponentProps<
	typeof TraceCollapsibleContent
> & {
	children: string;
};

export const ReasoningContent = memo(
	({ className, children, ...props }: ReasoningContentProps) => (
		<TraceCollapsibleContent className={className} {...props}>
			<SafeMarkdown>{children}</SafeMarkdown>
		</TraceCollapsibleContent>
	),
);

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";
