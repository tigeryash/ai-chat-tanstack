/** A file the user attached in the composer. Attachments don't send yet (roadmap 1.6). */
export type FileObject = {
	id: string;
	file: File;
	/** An object URL for images (revoke it when the attachment goes), "" for other files. */
	preview: string;
	/** A data URL, filled in once the file is processed. */
	base64: string;
	type: string;
	isProcessing: boolean;
};

export const MAX_ATTACHMENT_SIZE_MB = 20;

const ALLOWED_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"text/plain",
	"text/csv",
	"text/javascript",
	"text/typescript",
]);

// Browsers report no type (or a guessed one) for source files, so these go by extension.
const ALLOWED_EXTENSIONS = /\.(ts|tsx|js|jsx|py|cpp|h)$/;

export function isImage(file: File): boolean {
	return file.type.startsWith("image/");
}

export function isAllowedFile(file: File): boolean {
	if (file.size > MAX_ATTACHMENT_SIZE_MB * 1024 * 1024) return false;
	return ALLOWED_TYPES.has(file.type) || ALLOWED_EXTENSIONS.test(file.name);
}

/** The attachment as shown while it is being processed. */
export function toFileObject(file: File): FileObject {
	return {
		id: crypto.randomUUID(),
		file,
		// The URL outlives this call; useAttachments revokes it through revokePreview.
		// react-doctor-disable-next-line react-doctor/no-create-object-url-without-revoke
		preview: isImage(file) ? URL.createObjectURL(file) : "",
		base64: "",
		type: file.type,
		isProcessing: true,
	};
}

export function revokePreview(file: FileObject): void {
	if (file.preview) URL.revokeObjectURL(file.preview);
}

export function readAsDataUrl(file: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}
