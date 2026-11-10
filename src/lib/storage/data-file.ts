import { ChatStoreError } from "./errors";
import type { ExportBlobResult, ImportResult } from "./export";

// Settings → Your data (roadmap 1.10): the file name, the size check and the wording around
// `exportChats` / `importChats`. No Dexie here, so the settings page can load it up front; the stores
// load on first click (`data-transfer.ts`). Messages name counts only, never chat titles or contents.

/** Bigger than any library we expect (attachments are capped at 20 MB each), small enough to read. */
export const MAX_IMPORT_MB = 500;

/** `high-elo-llms-export-2026-11-09.json`, by the local date. */
export function exportFileName(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	return `high-elo-llms-export-${day}.json`;
}

interface ImportFile {
	size: number;
	text(): Promise<string>;
}

/** The file's text, refused before it's read when it's larger than `MAX_IMPORT_MB`. */
export async function readImportFile(file: ImportFile): Promise<string> {
	if (file.size > MAX_IMPORT_MB * 1024 * 1024) {
		throw new ChatStoreError(
			"too-large",
			`The file is larger than ${MAX_IMPORT_MB} MB.`,
		);
	}
	return file.text();
}

function count(n: number, one: string, many = `${one}s`): string {
	return `${n} ${n === 1 ? one : many}`;
}

export function exportSummary(result: Omit<ExportBlobResult, "blob">): string {
	const saved = `Exported ${count(result.chatCount, "chat")} and ${count(result.promptCount, "saved prompt")}.`;
	const unreadable = result.unreadableChatIds.length;
	return unreadable === 0
		? saved
		: `${saved} ${count(unreadable, "chat")} couldn't be read and ${unreadable === 1 ? "was" : "were"} left out.`;
}

export function importSummary(result: ImportResult): string {
	const parts = [
		`Chats: ${result.imported - result.updated} added, ${result.updated} updated, ${result.skipped} already up to date.`,
		`Saved prompts: ${result.promptsImported - result.promptsUpdated} added, ${result.promptsUpdated} updated, ${result.promptsSkipped} already up to date.`,
		`Workspaces: ${result.workspacesImported - result.workspacesUpdated} added, ${result.workspacesUpdated} updated, ${result.workspacesSkipped} already up to date.`,
		`Saved layouts: ${result.layoutsImported - result.layoutsUpdated} added, ${result.layoutsUpdated} updated, ${result.layoutsSkipped} already up to date.`,
	];
	if (result.otherAccounts > 0) {
		parts.push(
			`${count(result.otherAccounts, "chat")} ${result.otherAccounts === 1 ? "belongs" : "belong"} to another account and stay hidden until it signs in here.`,
		);
	}
	return parts.join(" ");
}

/** What the person sees when an import fails. Never the file's text or the validator's details. */
export function importErrorMessage(error: unknown): string {
	if (!(error instanceof ChatStoreError)) {
		return "Couldn't import the file. Nothing was changed.";
	}
	switch (error.code) {
		case "too-large":
			return `That file is larger than ${MAX_IMPORT_MB} MB, so it wasn't imported.`;
		case "too-new":
			return "That file comes from a newer version of the app. Reload to update, then try again.";
		default:
			return "That file isn't a High Elo LLMs export, or it's damaged. Nothing was changed.";
	}
}
