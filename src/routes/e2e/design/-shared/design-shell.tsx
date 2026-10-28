import { Link } from "@tanstack/react-router";
import {
	ChevronDownIcon,
	EllipsisIcon,
	MoonIcon,
	PinIcon,
	PlusIcon,
	SquarePenIcon,
	SunIcon,
} from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { brandLogos } from "@/components/auth/brand-logos";
import MessagesList from "@/components/chat/chatstuff/messages-list";
import { Input } from "@/components/chat/input";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
	ACTIVE_CHAT,
	type FixturePane,
	PANES,
	SIDEBAR_CHATS,
} from "./fixtures";

// The screen every design direction renders (roadmap 3.0): the real sidebar primitives, the real message
// list (with a reasoning trace) and the real composer, around fixture data. A direction changes only the
// CSS variables and the `design-*` hooks in its own stylesheet, scoped to `[data-design="<id>"]`.

export type Theme = "light" | "dark";

export const DIRECTIONS = [
	{ id: "minimal", letter: "A", label: "Minimal dark" },
	{ id: "brand", letter: "B", label: "Brand" },
	{ id: "editorial", letter: "C", label: "Editorial" },
] as const;

export type DirectionId = (typeof DIRECTIONS)[number]["id"];

type DesignShellProps = {
	direction: DirectionId;
	theme: Theme;
	/** Sits at the top of the sidebar, under the wordmark (direction B puts the landing shader there). */
	brandCard?: ReactNode;
	/** Decoration behind the panes. */
	backdrop?: ReactNode;
};

export function DesignShell({
	direction,
	theme,
	brandCard,
	backdrop,
}: DesignShellProps) {
	return (
		<div
			data-design={direction}
			className={cn("design-root h-svh", theme === "dark" && "dark")}
		>
			<SidebarProvider className="h-svh min-h-0">
				<DesignSidebar brandCard={brandCard} />
				<SidebarInset className="design-main relative h-svh overflow-hidden">
					{backdrop}
					<TopBar direction={direction} theme={theme} />
					<div className="design-panes relative grid min-h-0 flex-1 grid-cols-2">
						{PANES.map((pane, index) => (
							<Pane key={pane.id} pane={pane} index={index} />
						))}
					</div>
					<div className="design-composer relative flex justify-center px-4 pt-2 pb-4">
						<Input onSubmit={async () => {}} />
					</div>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}

function DesignSidebar({ brandCard }: { brandCard?: ReactNode }) {
	const group = (label: string, chats: string[], pinned = false) => (
		<SidebarGroup>
			<SidebarGroupLabel className="design-group-label">
				{label}
			</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{chats.map((title) => (
						<SidebarMenuItem key={title}>
							<SidebarMenuButton isActive={title === ACTIVE_CHAT}>
								{pinned && <PinIcon />}
								<span className="truncate">{title}</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);

	return (
		<Sidebar className="design-sidebar">
			<SidebarHeader>
				<div className="design-wordmark px-2 pt-1">High Elo LLMs</div>
				{brandCard}
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton>
							<SquarePenIcon />
							New chat
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				<SidebarInput
					type="search"
					aria-label="Search chats"
					placeholder="Search chats"
				/>
			</SidebarHeader>
			<SidebarContent>
				{group("Pinned", SIDEBAR_CHATS.pinned, true)}
				{group("Recent", SIDEBAR_CHATS.recent)}
			</SidebarContent>
		</Sidebar>
	);
}

function TopBar({
	direction,
	theme,
}: {
	direction: DirectionId;
	theme: Theme;
}) {
	const next: Theme = theme === "dark" ? "light" : "dark";
	return (
		<header className="design-topbar relative flex h-12 shrink-0 items-center gap-3 px-4">
			<h1 className="design-title truncate">{ACTIVE_CHAT}</h1>
			<nav
				aria-label="Design directions"
				className="design-switcher ml-auto flex items-center gap-1"
			>
				{DIRECTIONS.map((item) => (
					<Link
						key={item.id}
						to={`/e2e/design/${item.id}`}
						search={{ theme }}
						aria-current={item.id === direction ? "page" : undefined}
						className="design-switcher-item"
						title={item.label}
					>
						{item.letter}
					</Link>
				))}
			</nav>
			<Link
				to={`/e2e/design/${direction}`}
				search={{ theme: next }}
				aria-label={`Switch to ${next} mode`}
				className="design-icon-button"
			>
				{theme === "dark" ? <SunIcon /> : <MoonIcon />}
			</Link>
			<button type="button" className="design-add-pane">
				<PlusIcon />
				Add model
			</button>
		</header>
	);
}

function Pane({ pane, index }: { pane: FixturePane; index: number }) {
	const Logo = brandLogos[pane.brand].mono;
	return (
		<motion.section
			aria-label={`${pane.model} pane`}
			className="design-pane flex min-h-0 min-w-0 flex-col"
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				duration: 0.4,
				delay: 0.08 * index,
				ease: [0.4, 0, 0.2, 1],
			}}
		>
			<div className="design-pane-header flex shrink-0 items-center gap-2 px-3 py-2">
				<button type="button" className="design-model-trigger">
					<Logo size={16} />
					<span className="design-model-name">{pane.model}</span>
					<ChevronDownIcon className="size-3.5 opacity-60" />
				</button>
				<span className="design-via">via {pane.via}</span>
				<button
					type="button"
					aria-label="Pane options"
					className="design-icon-button ml-auto"
				>
					<EllipsisIcon />
				</button>
			</div>
			<div className="design-pane-body min-h-0 flex-1">
				<MessagesList messages={pane.messages} />
			</div>
		</motion.section>
	);
}
