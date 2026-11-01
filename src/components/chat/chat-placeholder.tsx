import type { ReactNode } from "react";

/** Stands in for a chat while it's read back from the store, or when it can't be opened. */
export function ChatPlaceholder({ children }: { children: ReactNode }) {
	return (
		<div
			role="status"
			className="flex h-full min-h-0 min-w-0 items-center justify-center rounded-pane border bg-card p-4 text-center text-muted-foreground text-sm"
		>
			{children}
		</div>
	);
}

/** What a chat that isn't open yet shows: "opening" while it's read, then why it can't be shown. */
export const OPENING_CHAT = "Opening chat…";
export const CHAT_FAILED = "Couldn't open this chat. Try reloading the page.";
