import type { AttachmentSupport } from "./validate";
import { isImageType } from "./validate";

// Per-pane capability checks for synced panes (roadmap 3.3, decision 17). One synced send goes to panes
// whose models read different files, so each pane works out which attached files its model can't read,
// and gets the message without them ("text only") or, if its person chose so, not at all ("skip").
// Only images and PDFs depend on the model: any other file the composer accepted (text, code) is read
// by every model, so it is never left out here.

const PDF_TYPE = "application/pdf";

/** The bits of an attachment the checks need: never its contents. */
export interface AttachedFileInfo {
	name: string;
	mediaType: string;
}

/** Whether a model with `support` reads a file of `mediaType`. Unknown support: let the provider decide. */
export function canRead(
	support: AttachmentSupport | undefined,
	mediaType: string,
): boolean {
	if (!support) return true;
	if (isImageType(mediaType)) return support.images;
	if (mediaType === PDF_TYPE) return support.pdfs;
	return true;
}

/** The attached files a pane's model can't read, in the order they were attached. */
export function unreadableFiles<T extends AttachedFileInfo>(
	files: readonly T[],
	support: AttachmentSupport | undefined,
): T[] {
	return files.filter((file) => !canRead(support, file.mediaType));
}

/** What one synced pane sends: these files with the text, or nothing at all. */
export type PaneSendPlan<T> =
	| { send: true; files: T[] }
	| { send: false; reason: "skipped" | "empty" };

/**
 * One pane's share of a synced send. Files its model can't read are left out; if its person chose to
 * skip the pane, it sends nothing, but only while there is such a file (a pick of a model that reads
 * them makes the choice moot). A message left with no text and no files isn't sent.
 */
export function planPaneSend<T extends { mediaType: string }>(
	text: string,
	files: readonly T[],
	{ support, skip }: { support: AttachmentSupport | undefined; skip: boolean },
): PaneSendPlan<T> {
	const readable = files.filter((file) => canRead(support, file.mediaType));
	if (readable.length < files.length && skip) {
		return { send: false, reason: "skipped" };
	}
	if (text.trim() === "" && readable.length === 0) {
		return { send: false, reason: "empty" };
	}
	return { send: true, files: readable };
}

/** The per-pane notice's sentence: which files this pane's model can't read. */
export function unreadableNotice(
	files: readonly AttachedFileInfo[],
	skip: boolean,
): string {
	const names = files.map((file) => file.name).join(", ");
	const them = files.length === 1 ? "it" : "them";
	return skip
		? `This model can't read ${names}, so this pane won't get the message.`
		: `This model can't read ${names}, so this pane gets the message without ${them}.`;
}
