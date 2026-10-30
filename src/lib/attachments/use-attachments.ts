import { useEffect, useRef, useState } from "react";
import { logError } from "@/lib/log";
import {
	type FileObject,
	isAllowedFile,
	revokePreview,
	toFileObject,
} from "./file-object";
import { processAttachment } from "./process";

/**
 * The composer's attachments. Paperclip and drag-and-drop both add through `add`, so they get the
 * same checks. Each image preview is an object URL, revoked when its attachment is removed or the
 * composer unmounts.
 */
export function useAttachments() {
	const [files, setFiles] = useState<FileObject[]>([]);
	// Every attachment whose preview is still alive, so unmount can revoke the ones never removed.
	const live = useRef(new Map<string, FileObject>());

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

	const process = async (pending: FileObject) => {
		try {
			const { file, base64 } = await processAttachment(pending.file);
			setFiles((prev) =>
				prev.map((f) =>
					f.id === pending.id ? { ...f, file, base64, isProcessing: false } : f,
				),
			);
		} catch (error) {
			logError("Reading an attachment failed", error);
			drop(pending.id);
		}
	};

	const add = async (selected: File[]) => {
		const added = selected.filter(isAllowedFile).map(toFileObject);
		if (added.length === 0) return;
		for (const file of added) live.current.set(file.id, file);
		setFiles((prev) => [...prev, ...added]);
		await Promise.all(added.map(process));
	};

	return { files, add, remove: drop };
}
