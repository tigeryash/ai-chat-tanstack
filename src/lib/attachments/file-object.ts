import type { FileUIPart } from "ai";

/** A file the user attached in the composer (roadmap 1.6). `validate.ts` decides which files get here. */
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

export function isImage(file: File): boolean {
	return file.type.startsWith("image/");
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

/** The AI SDK `file` part a processed attachment sends as. */
export function toFilePart(file: FileObject): FileUIPart {
	return {
		type: "file",
		mediaType: file.file.type || file.type,
		filename: file.file.name,
		url: file.base64,
	};
}
