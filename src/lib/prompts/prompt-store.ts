import { liveQuery } from "dexie";
import { type ChatDatabase, openChatDatabase } from "@/lib/storage/db";
import { ChatStoreError } from "@/lib/storage/errors";
import { ownerIdSchema } from "@/lib/storage/format";
import {
	newPrompt,
	PROMPT_FORMAT_VERSION,
	type Prompt,
	promptSchema,
	readPrompt,
	withLabels,
	withRestored,
	withText,
} from "./prompt";

// Where the prompt library lives (roadmap 3.6): the `prompts` table of the chat database, on this device
// only, like chats (decision 8). Each change reads, changes and writes a prompt in one transaction, so
// two tabs editing at once each add their version. Lists include every account's prompts: callers
// filter with `visibleChats` (src/lib/storage/ownership.ts) for the viewer, like chats.

export interface PromptStore {
	/** Newest change first. Unreadable prompts are left out. */
	listPrompts(): Promise<Prompt[]>;
	/** Checked on read; `undefined` if there is no such prompt. */
	getPrompt(id: string): Promise<Prompt | undefined>;
	createPrompt(input: {
		name: string;
		tags: readonly string[];
		text: string;
		ownerId: string | null;
	}): Promise<Prompt>;
	/** Saves `text` as a new version (nothing changes if it's the current text). */
	saveText(id: string, text: string): Promise<Prompt>;
	/** Renames and retags without a new version. */
	setLabels(
		id: string,
		labels: { name: string; tags: readonly string[] },
	): Promise<Prompt>;
	/** Adds `version`'s text again as the newest version. */
	restoreVersion(id: string, version: number): Promise<Prompt>;
	/** Moves prompts to another owner, skipping missing ones. Doesn't change `updatedAt`. */
	setPromptOwner(ids: readonly string[], ownerId: string | null): Promise<void>;
	/** Deleting a prompt that doesn't exist does nothing. */
	deletePrompt(id: string): Promise<void>;
	/** Like `ChatStore.watchChats`, for `listPrompts()`. */
	watchPrompts(
		onChange: (prompts: Prompt[]) => void,
		onError: (error: unknown) => void,
	): () => void;
}

export interface DexiePromptStoreOptions {
	db?: ChatDatabase;
	now?: () => number;
	newId?: () => string;
}

export function createDexiePromptStore(
	options: DexiePromptStoreOptions = {},
): PromptStore {
	const db = options.db ?? openChatDatabase();
	const now = options.now ?? Date.now;
	const newId = options.newId ?? (() => crypto.randomUUID());

	const write = async (prompt: Prompt) => {
		const checked = promptSchema.parse(prompt);
		await db.prompts.put({ ...checked, formatVersion: PROMPT_FORMAT_VERSION });
		return checked;
	};

	const change = (id: string, edit: (prompt: Prompt) => Prompt) =>
		db.transaction("rw", db.prompts, async () => {
			const row = await db.prompts.get(id);
			if (!row) throw new ChatStoreError("not-found", "No such prompt.");
			const prompt = readPrompt(row);
			const next = edit(prompt);
			return next === prompt ? prompt : write(next);
		});

	const listPrompts = async () => {
		const rows = await db.prompts.orderBy("updatedAt").reverse().toArray();
		return rows.flatMap((row) => {
			try {
				return [readPrompt(row)];
			} catch {
				return [];
			}
		});
	};

	return {
		listPrompts,

		async getPrompt(id) {
			const row = await db.prompts.get(id);
			return row && readPrompt(row);
		},

		async createPrompt(input) {
			if (!ownerIdSchema.safeParse(input.ownerId).success) {
				throw new ChatStoreError("invalid-chat", "An owner ID is invalid.");
			}
			return write(newPrompt({ ...input, id: newId(), now: now() }));
		},

		saveText: (id, text) => change(id, (p) => withText(p, text, now())),

		setLabels: (id, labels) => change(id, (p) => withLabels(p, labels, now())),

		restoreVersion: (id, version) =>
			change(id, (p) => withRestored(p, version, now())),

		async setPromptOwner(ids, ownerId) {
			if (!ownerIdSchema.safeParse(ownerId).success) {
				throw new ChatStoreError("invalid-chat", "An owner ID is invalid.");
			}
			await db.prompts
				.where("id")
				.anyOf([...ids])
				.modify({ ownerId });
		},

		async deletePrompt(id) {
			await db.prompts.delete(id);
		},

		watchPrompts(onChange, onError) {
			const subscription = liveQuery(listPrompts).subscribe({
				next: onChange,
				error: onError,
			});
			return () => subscription.unsubscribe();
		},
	};
}

let appStore: PromptStore | undefined;

/** The app's one prompt store. Browser only, like `chatStore()`. */
export function promptStore(): PromptStore {
	appStore ??= createDexiePromptStore();
	return appStore;
}
