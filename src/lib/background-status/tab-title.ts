// What the tab shows while it's in the background (roadmap 3.10): replies running now, or how the
// ones that ran while the person was away ended. Counts only, never chat content.

export interface TabActivity {
	/** Chats replying right now. */
	replying: number;
	/** Replies that finished since the tab was hidden. */
	finished: number;
	/** Replies that failed since the tab was hidden. */
	failed: number;
}

export type TabState = "idle" | "replying" | "finished" | "failed";

/** Running replies win; then a failure, so it isn't hidden behind the ones that went fine. */
export function tabState({
	replying,
	finished,
	failed,
}: TabActivity): TabState {
	if (replying > 0) return "replying";
	if (failed > 0) return "failed";
	if (finished > 0) return "finished";
	return "idle";
}

/** "● 2 replying — High Elo LLMs", "✓ Done — High Elo LLMs", or `baseTitle` with nothing to show. */
export function formatTabTitle(
	activity: TabActivity,
	baseTitle: string,
): string {
	const status = tabStatusText(activity);
	return status ? `${status} — ${baseTitle}` : baseTitle;
}

function tabStatusText(activity: TabActivity): string | undefined {
	switch (tabState(activity)) {
		case "replying":
			return activity.replying === 1
				? "● Replying"
				: `● ${activity.replying} replying`;
		case "failed":
			return activity.failed === 1
				? "! Reply failed"
				: `! ${activity.failed} replies failed`;
		case "finished":
			return "✓ Done";
		case "idle":
			return undefined;
	}
}

const DOT_COLORS: Record<Exclude<TabState, "idle">, string> = {
	replying: "#f59e0b",
	finished: "#16a34a",
	failed: "#dc2626",
};

/**
 * A small SVG favicon as a data URL (the CSP allows `data:` images): a coloured dot for the state.
 * `dim` is the second frame of the replying pulse.
 */
export function statusFaviconUrl(
	state: Exclude<TabState, "idle">,
	dim = false,
): string {
	const fill = DOT_COLORS[state];
	const opacity = dim ? 0.35 : 1;
	const mark =
		state === "finished"
			? `<path d="M10 16.5l4 4 8-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
			: state === "failed"
				? `<path d="M16 9v8M16 22v.5" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`
				: "";
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${fill}" fill-opacity="${opacity}"/>${mark}</svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
