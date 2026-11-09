import { useEffect, useRef, useState } from "react";
import { logError } from "@/lib/log";
import type { AttachedFileInfo } from "./capability";
import { type FileObject, revokePreview, toFileObject } from "./file-object";
import { processAttachment } from "./process";
import { AttachmentRefusal } from "./text-file";
import { type AttachmentSupport, checkAttachments } from "./validate";

export interface UseAttachmentsOptions {
	/** What the model reads; absent means unknown, so only type, size and count are checked. */
	support?: AttachmentSupport;
	/** Gets the reasons files were refused (user-facing, no contents), or [] once a pick is all fine. */
	onErrors?: (errors: string[]) => void;
	/** Gets the attached files' names and types (never contents) whenever the list changes. */
	onChange?: (files: AttachedFileInfo[]) => void;
}

/**
 * The composer's attachments. Paperclip and drag-and-drop both add through `add`, so they get the
 * same checks (`checkAttachments`). Each image preview is an object URL, revoked when its attachment
 * is removed, when the composer sends (`clear`), or when the composer unmounts.
 */
export function useAttachments({
	support,
	onErrors,
	onChange,
}: UseAttachmentsOptions = {}) {
	const [files, setFiles] = useState<FileObject[]>([]);
	// Synced panes (roadmap 3.3) check what's attached against each pane's model before the send.
	const onChangeRef = useRef(onChange);
	useEffect(() => {
		onChangeRef.current = onChange;
	});
	useEffect(() => {
		onChangeRef.current?.(
			files.map((f) => ({
				name: f.file.name,
				mediaType: f.file.type || f.type,
			})),
		);
	}, [files]);
	// Every attachment whose preview is still alive, so unmount can revoke the ones never removed.
	const live = useRef(new Map<string, FileObject>());
	// Reads still running, so a send can wait for them.
	const pending = useRef(new Set<Promise<void>>());

	useEffect(() => {
		const attached = live.current;
		return () => {
			for (const file of attached.values()) revokePreview(file);
			attached.clear();
		};
	}, []);

	const drop = (id: string) => {
		const file = live.current.get(id);
		if (file) revokePreview(file);
		live.current.delete(id);
		setFiles((prev) => prev.filter((f) => f.id !== id));
	};

	const clear = () => {
		for (const file of live.current.values()) revokePreview(file);
		live.current.clear();
		setFiles([]);
	};

	const process = async (attachment: FileObject) => {
		try {
			const { file, base64 } = await processAttachment(attachment.file);
			// Removed while it was read: its preview is already revoked.
			if (!live.current.has(attachment.id)) return;
			const done = { ...attachment, file, base64, isProcessing: false };
			live.current.set(attachment.id, done);
			setFiles((prev) => prev.map((f) => (f.id === attachment.id ? done : f)));
		} catch (error) {
			drop(attachment.id);
			// A refusal (not text) is the file, not a fault, so it isn't logged.
			if (error instanceof AttachmentRefusal) {
				onErrors?.([error.message]);
				return;
			}
			logError("Reading an attachment failed", error);
			onErrors?.([`${attachment.file.name} couldn't be read.`]);
		}
	};

	const add = async (selected: File[]) => {
		const { accepted, errors } = checkAttachments(selected, {
			attached: live.current.size,
			support,
		});
		onErrors?.(errors);
		const added = accepted.map(toFileObject);
		if (added.length === 0) return;
		for (const file of added) live.current.set(file.id, file);
		setFiles((prev) => [...prev, ...added]);
		const reads = added.map((file) => {
			const read = process(file).finally(() => pending.current.delete(read));
			pending.current.add(read);
			return read;
		});
		await Promise.all(reads);
	};

	/** Waits for every attachment to be read, then gives the ones still attached. */
	const settled = async (): Promise<FileObject[]> => {
		while (pending.current.size > 0) await Promise.all(pending.current);
		return [...live.current.values()];
	};

	return {
		files,
		add,
		remove: drop,
		clear,
		settled,
	};
}
