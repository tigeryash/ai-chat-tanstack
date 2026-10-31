import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

// The dashboard header's free space, next to the sidebar toggle. A page puts its own controls there
// with `<InHeader>` (the workspace toolbar, roadmap 3.1) instead of spending a row on them.

const HEADER_SLOT_ID = "dashboard-header-slot";

export function HeaderSlot() {
	return (
		<div
			id={HEADER_SLOT_ID}
			className="flex min-w-0 flex-1 items-center gap-2"
		/>
	);
}

/** Renders `children` in the header slot, or in place where there's none. */
export function InHeader({ children }: { children: ReactNode }) {
	const [slot, setSlot] = useState<HTMLElement | null | undefined>(undefined);
	useEffect(() => setSlot(document.getElementById(HEADER_SLOT_ID)), []);
	if (slot === undefined) return null;
	return slot ? createPortal(children, slot) : children;
}
