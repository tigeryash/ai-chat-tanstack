import { promptStore } from "@/lib/prompts/prompt-store";
import { savedLayoutStore } from "@/lib/workspaces/saved-layouts";
import { chatStore } from "./app-store";
import { readImportFile } from "./data-file";
import {
	type ExportBlobResult,
	exportChatsBlob,
	type ImportResult,
	importChats,
} from "./export";
import type { Viewer } from "./ownership";

// Settings → Your data (roadmap 1.10) on the app's own stores. Loaded with `import()` from the settings
// page, so Dexie and the chat format stay out of its first load.

/** The viewer's chats (with branches and attachments), saved prompts, workspaces and saved layouts, as one JSON file. */
export function exportLocalData(viewer: Viewer): Promise<ExportBlobResult> {
	return exportChatsBlob(chatStore(), viewer, promptStore(), savedLayoutStore);
}

/** Checks the file's size, then imports it by `importChats`' rules (all or nothing, newer copy wins). */
export async function importLocalData(
	file: File,
	viewer: Viewer,
): Promise<ImportResult> {
	const json = await readImportFile(file);
	return importChats(
		chatStore(),
		json,
		viewer,
		promptStore(),
		savedLayoutStore,
	);
}
