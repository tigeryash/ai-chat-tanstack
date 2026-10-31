import { LayoutGroup, motion, type Transition } from "motion/react";
import {
	Fragment,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { ChatScreen } from "@/components/chat/chat-screen";
import { InHeader } from "@/components/header-slot";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { openChat } from "@/lib/chat/chat-sessions";
import { retainChat } from "@/lib/chat/open-chats";
import { logError } from "@/lib/log";
import { usePrefersReducedMotion } from "@/lib/reduced-motion";
import { chatStore } from "@/lib/storage/app-store";
import type { Workspace, WorkspacePane } from "@/lib/storage/workspace";
import {
	layoutOf,
	movePane,
	removePane,
	resizePanes,
	setPaneSynced,
} from "@/lib/workspaces/pane-layout";
import { createPaneSync, usePaneSyncState } from "@/lib/workspaces/pane-sync";
import { addNewPane } from "@/lib/workspaces/workspace-sessions";
import { PaneActions } from "./pane-actions";
import { WorkspaceToolbar } from "./workspace-toolbar";

// A workspace (roadmaps 3.1 and 3.2): up to four chat panes side by side, each with its own model,
// settings and composer, resizable and reorderable. Synced panes share the draft and send together.
// Below `md`, one pane shows at a time; the others stay mounted (hidden), so synced sends reach them.
// Every change is saved to the workspace record, so a reload restores panes, order and widths.

const PANE_MIN_SIZE = "15%";
/** Panes fade in and slide to their new place. Reduced motion (hard rule 3) makes both instant. */
const PANE_TRANSITION: Transition = { duration: 0.25, ease: [0.4, 0, 0.2, 1] };
const INSTANT: Transition = { duration: 0 };

/** Keeps every pane's chat open while the workspace is on screen (quality audit P8). */
function useRetainPanes(panes: readonly WorkspacePane[]) {
	const ids = panes.map((pane) => pane.chatId).join(",");
	useEffect(() => {
		const releases = ids.split(",").map((id) => retainChat(id));
		return () => {
			for (const release of releases) release();
		};
	}, [ids]);
}

/**
 * Whether the element has been laid out with a width. A new panel starts at zero width for a frame,
 * and the composer sizes its text box on its first render, so a pane's content waits for a width.
 */
function useHasWidth() {
	const ref = useRef<HTMLDivElement>(null);
	const [hasWidth, setHasWidth] = useState(false);
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element || hasWidth) return;
		if (element.offsetWidth > 0) return setHasWidth(true);
		const observer = new ResizeObserver(() => {
			if (element.offsetWidth > 0) setHasWidth(true);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [hasWidth]);
	return [ref, hasWidth] as const;
}

/** One desktop pane: fades in when added, slides when the order changes. */
function PaneMotion({
	transition,
	children,
}: {
	transition: Transition;
	children: ReactNode;
}) {
	const [ref, hasWidth] = useHasWidth();
	return (
		<motion.div
			ref={ref}
			layout="position"
			initial={transition === INSTANT ? false : { opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={transition}
			className="h-full"
			data-pane-motion
		>
			{hasWidth && children}
		</motion.div>
	);
}

export function WorkspaceView({ initial }: { initial: Workspace }) {
	const [workspace, setWorkspace] = useState(initial);
	const [hub] = useState(createPaneSync);
	const { diverged } = usePaneSyncState(hub);
	const [saveFailed, setSaveFailed] = useState(false);
	const [shownId, setShownId] = useState(initial.panes[0]?.chatId);
	const isMobile = useIsMobile();
	const reduced = usePrefersReducedMotion();
	const { panes } = workspace;
	useRetainPanes(panes);

	const save = (next: WorkspacePane[]) => {
		setWorkspace({ ...workspace, panes: next });
		setSaveFailed(false);
		chatStore()
			.saveWorkspace({
				id: workspace.id,
				ownerId: workspace.ownerId,
				panes: next,
			})
			.catch((error) => {
				logError("Couldn't save the workspace:", error);
				setSaveFailed(true);
			});
	};
	const addPane = () => {
		const next = addNewPane(workspace);
		save(next);
		setShownId(next[next.length - 1]?.chatId);
	};
	const shown = panes.find((pane) => pane.chatId === shownId) ?? panes[0];

	const renderPane = (pane: WorkspacePane, index: number) => {
		const label = `Pane ${index + 1}`;
		const chat = openChat(pane.chatId);
		return (
			<section
				aria-label={label}
				data-pane-id={pane.chatId}
				className="h-full min-h-0 min-w-0"
			>
				<ChatScreen
					chat={chat}
					sync={{ hub, synced: pane.synced }}
					paneCount={panes.length}
					actions={
						<PaneActions
							chat={chat}
							label={label}
							synced={pane.synced}
							onSyncedChange={(synced) =>
								save(setPaneSynced(panes, pane.chatId, synced))
							}
							onMoveLeft={
								index > 0
									? () => save(movePane(panes, pane.chatId, -1))
									: undefined
							}
							onMoveRight={
								index < panes.length - 1
									? () => save(movePane(panes, pane.chatId, 1))
									: undefined
							}
							onClose={
								panes.length > 1
									? () => save(removePane(panes, pane.chatId))
									: undefined
							}
						/>
					}
				/>
			</section>
		);
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			<InHeader>
				<WorkspaceToolbar
					panes={panes}
					shownId={isMobile ? shown?.chatId : undefined}
					onShow={setShownId}
					diverged={diverged}
					saveFailed={saveFailed}
					onAddPane={addPane}
				/>
			</InHeader>
			{isMobile ? (
				panes.map((pane, index) => (
					<div
						key={pane.chatId}
						id={`pane-${pane.chatId}`}
						role="tabpanel"
						hidden={pane !== shown}
						className="min-h-0 flex-1"
					>
						{renderPane(pane, index)}
					</div>
				))
			) : (
				<DesktopPanes
					panes={panes}
					transition={reduced ? INSTANT : PANE_TRANSITION}
					onResize={(layout) => save(resizePanes(panes, layout))}
					renderPane={renderPane}
				/>
			)}
		</div>
	);
}

/** Resizable panes in a row. */
function DesktopPanes({
	panes,
	transition,
	onResize,
	renderPane,
}: {
	panes: readonly WorkspacePane[];
	transition: Transition;
	onResize: (layout: Record<string, number>) => void;
	renderPane: (pane: WorkspacePane, index: number) => ReactNode;
}) {
	// When panes come or go, the group lays them out again from each panel's `defaultSize`, which
	// pane-layout.ts has already made equal.
	return (
		<LayoutGroup>
			<ResizablePanelGroup
				defaultLayout={layoutOf(panes)}
				onLayoutChanged={(layout, meta) => {
					if (meta.isUserInteraction) onResize(layout);
				}}
				className="min-h-0 flex-1"
			>
				{panes.map((pane, index) => (
					<Fragment key={pane.chatId}>
						{index > 0 && (
							<ResizableHandle
								aria-label={`Resize panes ${index} and ${index + 1}`}
								className="mx-1 bg-transparent"
							/>
						)}
						<ResizablePanel
							id={pane.chatId}
							defaultSize={`${pane.size}%`}
							minSize={PANE_MIN_SIZE}
						>
							<PaneMotion transition={transition}>
								{renderPane(pane, index)}
							</PaneMotion>
						</ResizablePanel>
					</Fragment>
				))}
			</ResizablePanelGroup>
		</LayoutGroup>
	);
}
