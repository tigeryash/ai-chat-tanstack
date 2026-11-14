import { paletteOpenedFrom } from "@/lib/commands/palette-state";

// Where focus goes when the palette closes (roadmap R2 S5): back where it was, with the cursor where it
// was in a text field (the composer keeps its caret). Base UI focuses the element; the selection is put
// back once the palette has closed, in case focusing moved it.

type TextField = HTMLInputElement | HTMLTextAreaElement;

interface Selection {
	field: TextField;
	start: number;
	end: number;
	direction: "forward" | "backward" | "none";
}

function isTextField(element: Element | null): element is TextField {
	return (
		element instanceof HTMLTextAreaElement ||
		(element instanceof HTMLInputElement && element.selectionStart !== null)
	);
}

/** Reads the cursor of the field the palette opened from. Call when the palette opens. */
export function saveSelection(): Selection | null {
	const field = paletteOpenedFrom();
	if (!isTextField(field)) return null;
	return {
		field,
		start: field.selectionStart ?? 0,
		end: field.selectionEnd ?? 0,
		direction: field.selectionDirection ?? "none",
	};
}

/** The element to return focus to, if it's still on the page. */
export function returnElement(): HTMLElement | null {
	const element = paletteOpenedFrom();
	return element instanceof HTMLElement &&
		element !== document.body &&
		element.isConnected
		? element
		: null;
}

export function restoreSelection(selection: Selection | null): void {
	if (!selection?.field.isConnected) return;
	if (document.activeElement !== selection.field) return;
	selection.field.setSelectionRange(
		selection.start,
		selection.end,
		selection.direction,
	);
}
