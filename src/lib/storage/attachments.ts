import type { FileUIPart, UIMessage } from "ai";
import type { ChatBranches } from "./branches";

// Attachments on this device (roadmap 1.6). In the app a sent file is an AI SDK `file` part whose `url` is
// a data URL, which is what the transport sends and what an `<img>` shows. In IndexedDB the bytes live in
// their own `attachments` table, and the stored part keeps only `attachment:<id>`, so message rows stay
// small and a chat's messages can be rewritten on every save without copying its files again.
// `getChat` turns the references back into data URLs, so exports carry the files and imports store them.

export const ATTACHMENT_URL_PREFIX = "attachment:";

/** One stored file. `id` is `<chatId>/<messageId>/<part index>`, so saving again finds it in place. */
export interface AttachmentRow {
	id: string;
	chatId: string;
	mediaType: string;
	bytes: Uint8Array;
}

const DATA_URL = /^data:([^;,]*)((?:;[^;,]*)*),(.*)$/s;

/** The bytes of a data URL, or undefined if it isn't one. */
export function dataUrlToBytes(
	url: string,
): { mediaType: string; bytes: Uint8Array } | undefined {
	const match = DATA_URL.exec(url);
	if (!match) return undefined;
	const [, mediaType = "", params = "", payload = ""] = match;
	if (params.split(";").includes("base64")) {
		try {
			const binary = atob(payload);
			return {
				mediaType,
				bytes: Uint8Array.from(binary, (c) => c.charCodeAt(0)),
			};
		} catch {
			return undefined;
		}
	}
	return {
		mediaType,
		bytes: new TextEncoder().encode(decodeURIComponent(payload)),
	};
}

const CHUNK = 0x8000;

export function bytesToDataUrl(mediaType: string, bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return `data:${mediaType};base64,${btoa(binary)}`;
}

type Part = UIMessage["parts"][number];

function mapFileParts(
	message: UIMessage,
	map: (part: FileUIPart, index: number) => FileUIPart | undefined,
): UIMessage {
	if (!message.parts.some((part) => part.type === "file")) return message;
	const parts = message.parts.flatMap((part: Part, index): Part[] => {
		if (part.type !== "file") return [part];
		const mapped = map(part, index);
		return mapped ? [mapped] : [];
	});
	return { ...message, parts };
}

function mapBranches(
	branches: ChatBranches | undefined,
	map: (message: UIMessage) => UIMessage,
): ChatBranches | undefined {
	return (
		branches && {
			...branches,
			messages: branches.messages.map((entry) => ({
				...entry,
				message: map(entry.message),
			})),
		}
	);
}

export interface DehydratedChat {
	messages: UIMessage[];
	branches: ChatBranches | undefined;
	/** Files that came in as data URLs, to write. */
	rows: AttachmentRow[];
}

/** Moves every data-URL file part's bytes into rows; the parts keep a reference. Pure. */
export function dehydrateAttachments(
	chatId: string,
	messages: readonly UIMessage[],
	branches?: ChatBranches,
): DehydratedChat {
	const rows = new Map<string, AttachmentRow>();
	const dehydrate = (message: UIMessage) =>
		mapFileParts(message, (part, index) => {
			const file = dataUrlToBytes(part.url);
			if (!file) return part;
			const id = `${chatId}/${message.id}/${index}`;
			rows.set(id, {
				id,
				chatId,
				mediaType: part.mediaType || file.mediaType,
				bytes: file.bytes,
			});
			return { ...part, url: `${ATTACHMENT_URL_PREFIX}${id}` };
		});
	return {
		messages: messages.map(dehydrate),
		branches: mapBranches(branches, dehydrate),
		rows: [...rows.values()],
	};
}

/** Every attachment id the messages and branches point to. */
export function referencedAttachments(
	messages: readonly UIMessage[],
	branches?: ChatBranches,
): Set<string> {
	const ids = new Set<string>();
	const collect = (message: UIMessage) => {
		for (const part of message.parts) {
			if (part.type === "file" && part.url.startsWith(ATTACHMENT_URL_PREFIX)) {
				ids.add(part.url.slice(ATTACHMENT_URL_PREFIX.length));
			}
		}
	};
	for (const message of messages) collect(message);
	for (const entry of branches?.messages ?? []) collect(entry.message);
	return ids;
}

/**
 * Turns references back into data URLs. A reference whose file is gone (or a URL scheme the app never
 * writes) is dropped, so nothing tries to send or show it.
 */
export function hydrateAttachments<
	T extends { messages: UIMessage[]; branches?: ChatBranches },
>(chat: T, rows: readonly AttachmentRow[]): T {
	const byId = new Map(rows.map((row) => [row.id, row]));
	const hydrate = (message: UIMessage) =>
		mapFileParts(message, (part) => {
			if (!part.url.startsWith(ATTACHMENT_URL_PREFIX)) return part;
			const row = byId.get(part.url.slice(ATTACHMENT_URL_PREFIX.length));
			return row && { ...part, url: bytesToDataUrl(row.mediaType, row.bytes) };
		});
	const branches = mapBranches(chat.branches, hydrate);
	return {
		...chat,
		messages: chat.messages.map(hydrate),
		...(branches && { branches }),
	};
}
