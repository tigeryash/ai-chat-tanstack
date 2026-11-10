import { useEffect, useState, useSyncExternalStore } from "react";
import { type AttachmentList, createAttachmentList } from "./attachment-list";
import type { AttachmentSupport } from "./validate";

export interface UseAttachmentsOptions {
	/** What the model reads; absent means unknown, so only type, size and count are checked. */
	support?: AttachmentSupport;
	/** Gets the reasons files were refused (user-facing, no contents), or [] once a pick is all fine. */
	onErrors?: (errors: string[]) => void;
	/**
	 * A list kept outside, so synced composers share one (roadmap 3.3); its owner lets go of its
	 * previews. Without it, the composer keeps its own and revokes its previews when it unmounts.
	 */
	list?: AttachmentList;
}

/** The composer's attachments: its own `AttachmentList`, or the one it's given. */
export function useAttachments({
	support,
	onErrors,
	list: shared,
}: UseAttachmentsOptions = {}) {
	const [own] = useState(createAttachmentList);
	const list = shared ?? own;
	const files = useSyncExternalStore(
		list.subscribe,
		list.getFiles,
		list.getFiles,
	);
	useEffect(() => () => own.clear(), [own]);

	return {
		files,
		add: (selected: File[]) => list.add(selected, { support, onErrors }),
		remove: list.remove,
		clear: list.clear,
		settled: list.settled,
	};
}
