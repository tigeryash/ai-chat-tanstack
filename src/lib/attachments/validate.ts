// The one check for attachments (roadmap 1.6). The paperclip and drag-and-drop both add files through
// `useAttachments().add`, which runs this, so they accept and refuse the same files with the same words.
// Decision 17: files are checked when attached, not at send time. Text and code files (1.6b) have their own
// rules in `text-file.ts`.

import { isTextFile, TEXT_FILE_ACCEPT, textFileRefusal } from "./text-file";

export const MAX_ATTACHMENT_SIZE_MB = 20;
export const MAX_ATTACHMENTS = 10;

const IMAGE_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif",
]);
const PDF_TYPE = "application/pdf";

/** For the file picker's `accept`, so it offers only what the check lets through. */
export const ACCEPTED_FILE_TYPES = [
	...IMAGE_TYPES,
	PDF_TYPE,
	TEXT_FILE_ACCEPT,
].join(",");

/**
 * What the pane's model reads, from the catalog's input modalities. Absent (a local or custom model, or
 * the catalog not loaded yet): unknown, so every accepted type goes and the provider has the last word.
 */
export interface AttachmentSupport {
	images: boolean;
	pdfs: boolean;
}

export interface AttachmentCheck {
	accepted: File[];
	/** One short, user-facing sentence per refused file or rule. Never the file's contents. */
	errors: string[];
}

export function isImageType(mediaType: string): boolean {
	return IMAGE_TYPES.has(mediaType);
}

/** Catalog modalities → support: Gateway lists images as "image" and PDFs as "file". */
export function supportFromModalities(
	inputModalities: readonly string[] | undefined,
): AttachmentSupport | undefined {
	if (!inputModalities) return undefined;
	return {
		images: inputModalities.includes("image"),
		pdfs: inputModalities.includes("file") || inputModalities.includes("pdf"),
	};
}

function refusal(file: File, support?: AttachmentSupport): string | undefined {
	const image = isImageType(file.type);
	if (!image && file.type !== PDF_TYPE && isTextFile(file)) {
		return textFileRefusal(file);
	}
	if (!image && file.type !== PDF_TYPE) {
		return `${file.name} can't be attached. Attach images (PNG, JPEG, WebP, GIF), PDFs, or text and code files.`;
	}
	if (file.size > MAX_ATTACHMENT_SIZE_MB * 1024 * 1024) {
		return `${file.name} is larger than ${MAX_ATTACHMENT_SIZE_MB} MB.`;
	}
	if (support && image && !support.images) {
		return `This model can't read images, so ${file.name} wasn't attached.`;
	}
	if (support && !image && !support.pdfs) {
		return `This model can't read PDFs, so ${file.name} wasn't attached.`;
	}
	return undefined;
}

/** Splits `selected` into the files to attach and the reasons for the rest. */
export function checkAttachments(
	selected: readonly File[],
	{
		attached = 0,
		support,
	}: { attached?: number; support?: AttachmentSupport } = {},
): AttachmentCheck {
	const errors: string[] = [];
	const allowed: File[] = [];
	for (const file of selected) {
		const reason = refusal(file, support);
		if (reason) errors.push(reason);
		else allowed.push(file);
	}
	const room = Math.max(0, MAX_ATTACHMENTS - attached);
	if (allowed.length > room) {
		errors.push(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
	}
	return { accepted: allowed.slice(0, room), errors };
}
