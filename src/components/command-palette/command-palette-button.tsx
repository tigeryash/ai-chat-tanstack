import { useSidebar } from "@/components/ui/sidebar";
import { openCommandPalette } from "@/lib/commands/palette-state";
import { isApplePlatform } from "@/lib/commands/shortcut";
import { preloadCommandPalette } from "./command-palette-host";

/** The sidebar's search-row button for the command palette, showing its shortcut (roadmap R2 S5). */
export function CommandPaletteButton() {
	const { isMobile, setOpenMobile } = useSidebar();
	const apple = isApplePlatform();
	return (
		<button
			type="button"
			aria-label="Command palette"
			aria-keyshortcuts={apple ? "Meta+K" : "Control+K"}
			title="Command palette"
			onPointerEnter={preloadCommandPalette}
			onFocus={preloadCommandPalette}
			onClick={() => {
				// On a phone the sidebar is a sheet; the palette takes its place.
				if (isMobile) setOpenMobile(false);
				openCommandPalette();
			}}
			className="h-8 shrink-0 rounded-md border bg-background px-2 font-medium text-muted-foreground text-xs outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
		>
			<kbd aria-hidden className="font-sans">
				{apple ? "⌘K" : "Ctrl K"}
			</kbd>
		</button>
	);
}
