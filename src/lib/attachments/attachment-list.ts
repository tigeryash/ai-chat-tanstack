import { logError } from "@/lib/log";
import { type FileObject, revokePreview, toFileObject } from "./file-object";
import { processAttachment } from "./process";
import { AttachmentRefusal } from "./text-file";
import { type AttachmentSupport, checkAttachments } from "./validate";

/**
 * A composer's attachments, outside React so synced composers can share one (roadmap 3.3): files added
 * in any synced composer show in all of them, a chip removed in one goes everywhere, and a send from
 * any of them sends and clears the same files. Paperclip and drag-and-drop both add through `add`, so
 * they get the same checks (`checkAttachments`). Each image preview is an object URL, revoked when its
 * attachment is removed or on `clear` (a send, or the list's owner going away).
 */
export interface AttachmentList {
	getFiles(): FileObject[];
	subscribe(listener: () => void): () => void;
	/**
	 * Checks and adds `selected`, then reads them. `onErrors` gets the reasons files were refused
	 * (user-facing, no contents), or [] once a pick is all fine.
	 */
	add(
		selected: File[],
		options?: {
			support?: AttachmentSupport;
			onErrors?: (errors: string[]) => void;
		},
	): Promise<void>;
	remove(id: string): void;
	/** Lets go of every file (and its preview): after a send. */
	clear(): void;
	/** Waits for every attachment to be read, then gives the ones still attached. */
	settled(): Promise<FileObject[]>;
}

export function createAttachmentList(): AttachmentList {
	let files: FileObject[] = [];
	// Reads still running, so a send can wait for them.
	const pending = new Set<Promise<void>>();
	const listeners = new Set<() => void>();

	const set = (next: FileObject[]) => {
		files = next;
		for (const listener of listeners) listener();
	};
	const has = (id: string) => files.some((f) => f.id === id);

	const remove = (id: string) => {
		const file = files.find((f) => f.id === id);
		if (!file) return;
		revokePreview(file);
		set(files.filter((f) => f.id !== id));
	};

	const read = async (
		attachment: FileObject,
		onErrors?: (errors: string[]) => void,
	) => {
		try {
			const { file, base64 } = await processAttachment(attachment.file);
			// Removed (or sent) while it was read: its preview is already revoked.
			if (!has(attachment.id)) return;
			const done = { ...attachment, file, base64, isProcessing: false };
			set(files.map((f) => (f.id === attachment.id ? done : f)));
		} catch (error) {
			remove(attachment.id);
			// A refusal (not text) is the file, not a fault, so it isn't logged.
			if (error instanceof AttachmentRefusal) {
				onErrors?.([error.message]);
				return;
			}
			logError("Reading an attachment failed", error);
			onErrors?.([`${attachment.file.name} couldn't be read.`]);
		}
	};

	return {
		getFiles: () => files,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		async add(selected, { support, onErrors } = {}) {
			const { accepted, errors } = checkAttachments(selected, {
				attached: files.length,
				support,
			});
			onErrors?.(errors);
			const added = accepted.map(toFileObject);
			if (added.length === 0) return;
			set([...files, ...added]);
			const reads = added.map((file) => {
				const reading = read(file, onErrors).finally(() =>
					pending.delete(reading),
				);
				pending.add(reading);
				return reading;
			});
			await Promise.all(reads);
		},
		remove,
		clear() {
			if (files.length === 0) return;
			for (const file of files) revokePreview(file);
			set([]);
		},
		async settled() {
			while (pending.size > 0) await Promise.all(pending);
			return files;
		},
	};
}
