import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setShortcutSheetOpen } from "@/lib/commands/shortcut-sheet-state";
import { ShortcutList } from "./shortcut-list";

// The keyboard shortcut sheet (roadmap R2 S6): Cmd+/ or ? (outside text fields), and the palette's
// "Keyboard shortcuts". Loaded on first open. Under reduced motion it only fades (`data-fade-only`).

export function ShortcutSheet({ open }: { open: boolean }) {
	return (
		<Dialog.Root open={open} onOpenChange={setShortcutSheetOpen}>
			<Dialog.Portal>
				<Dialog.Backdrop
					data-fade-only
					className="fixed inset-0 z-50 bg-overlay/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"
				/>
				<Dialog.Popup
					data-fade-only
					data-testid="shortcut-sheet"
					className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-pane border bg-popover text-popover-foreground shadow-2xl outline-none transition-[opacity,scale] duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-[0.98] motion-safe:data-starting-style:scale-[0.98]"
				>
					<div className="flex items-center justify-between gap-2 border-b px-4 py-3">
						<Dialog.Title className="font-medium text-base">
							Keyboard shortcuts
						</Dialog.Title>
						<Dialog.Close
							render={
								<Button variant="ghost" size="icon-sm" aria-label="Close" />
							}
						>
							<XIcon />
						</Dialog.Close>
					</div>
					<div className="overflow-y-auto p-4">
						<ShortcutList />
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
