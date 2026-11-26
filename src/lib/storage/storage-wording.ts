import type { PersistenceState } from "./persistence";
import type { LocalChatUsage } from "./storage-usage";

// Wording for Settings → Your data (Refine S11). No Dexie here, so the settings dialog can show it
// without loading the chat store.

const UNITS = ["bytes", "KB", "MB", "GB", "TB"] as const;

/** 1536 → "1.5 KB": one decimal under 10 of a unit, none above. */
export function formatBytes(bytes: number): string {
	let value = Math.max(0, bytes);
	let unit = 0;
	while (value >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit++;
	}
	if (unit === 0)
		return `${Math.round(value)} ${value === 1 ? "byte" : "bytes"}`;
	const shown = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
	return `${shown} ${UNITS[unit]}`;
}

function count(n: number, one: string, many: string): string {
	return `${n.toLocaleString("en")} ${n === 1 ? one : many}`;
}

/** "3 chats and 1 attached file". */
export function usageSummary({ chats, attachments }: LocalChatUsage): string {
	return `${count(chats, "chat", "chats")} and ${count(attachments, "attached file", "attached files")}`;
}

/** "1.2 MB of about 2 GB the browser allows this site", or null when the browser doesn't say. */
export function estimateSummary(
	usageBytes: number | null,
	quotaBytes: number | null,
): string | null {
	if (usageBytes === null) return null;
	const used = `${formatBytes(usageBytes)} used by this site in this browser`;
	return quotaBytes === null
		? used
		: `${used}, of about ${formatBytes(quotaBytes)} it allows`;
}

export const PERSISTENCE_TEXT: Record<PersistenceState, string> = {
	persisted:
		"On. The browser won't clear your chats to free up space; only you can, by clearing site data.",
	"not-persisted":
		"Off. The browser may clear your chats when the device runs low on space (Safari can after 7 days without a visit). Export them to keep a copy.",
	unsupported:
		"This browser can't keep storage persistent. Export your chats to keep a copy.",
};

/** After asking: what to say when the browser said no. */
export const PERSISTENCE_DENIED =
	"The browser said no. Chrome and Edge decide by how often you use the site, so it may say yes later.";
