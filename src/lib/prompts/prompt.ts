import { MAX_SYSTEM_PROMPT_LENGTH } from "@/lib/params/settings";
import { ChatStoreError, issuesOf } from "@/lib/storage/errors";
import { chatIdSchema, ownerIdSchema } from "@/lib/storage/format";
import { z } from "@/lib/zod";

// A saved prompt in the prompt library (roadmap 3.6, decision 19): a name, tags, and its text's version
// history. Every edit of the text is a new version, and restoring an old one adds it again as the
// newest, so history only grows (up to MAX_VERSIONS). The name and tags are labels, not versioned.
// Prompts have their own format (like workspaces); bump PROMPT_FORMAT_VERSION and migrate in
// `readPrompt` when the record's shape changes. Prompt text is content: never log or track it.

export const PROMPT_FORMAT_VERSION = 1;
export const MAX_PROMPT_NAME_LENGTH = 120;
export const MAX_TAG_LENGTH = 40;
export const MAX_TAGS = 20;
/** The oldest versions go first once there are more. */
export const MAX_VERSIONS = 200;
/** Models a prompt can be the default for (roadmap 3.6b). */
export const MAX_DEFAULT_MODELS = 100;
export const MAX_MODEL_KEY_LENGTH = 300;

export interface PromptVersion {
	/** 1 for the first text, counting up; never reused, even after old ones are dropped. */
	version: number;
	text: string;
	/** Milliseconds since the epoch. */
	createdAt: number;
	/** The version this one restored, if it's a restore. */
	restoredFrom?: number;
}

export interface Prompt {
	id: string;
	/** Like a chat's (roadmap 1.9): a Better Auth user ID, or null when made signed out. */
	ownerId: string | null;
	name: string;
	/** Lowercase, trimmed, unique, in the order added. */
	tags: string[];
	/** Oldest first; the last is the current text. Never empty. */
	versions: PromptVersion[];
	/**
	 * The models this prompt is the default system prompt for (roadmap 3.6b, decision 19), by
	 * `modelKey` (src/lib/chat/chat-settings.ts). Absent when none. Optional, so no format change.
	 */
	defaultFor?: string[];
	createdAt: number;
	updatedAt: number;
}

const timestamp = z.number().int().nonnegative();

const versionSchema = z.object({
	version: z.number().int().min(1),
	text: z.string().max(MAX_SYSTEM_PROMPT_LENGTH),
	createdAt: timestamp,
	restoredFrom: z.number().int().min(1).optional(),
});

export const promptSchema = z.object({
	id: chatIdSchema,
	ownerId: ownerIdSchema,
	name: z.string().min(1).max(MAX_PROMPT_NAME_LENGTH),
	tags: z.array(z.string().min(1).max(MAX_TAG_LENGTH)).max(MAX_TAGS),
	versions: z
		.array(versionSchema)
		.min(1)
		.max(MAX_VERSIONS)
		.refine(
			(versions) =>
				versions.every(
					(entry, i) => i === 0 || entry.version > versions[i - 1].version,
				),
			"Versions are out of order.",
		),
	defaultFor: z
		.array(z.string().min(1).max(MAX_MODEL_KEY_LENGTH))
		.max(MAX_DEFAULT_MODELS)
		.optional(),
	createdAt: timestamp,
	updatedAt: timestamp,
});

/** A stored prompt, checked. Throws a ChatStoreError for a bad or newer record. */
export function readPrompt(raw: unknown): Prompt {
	const version = (raw as { formatVersion?: unknown } | null)?.formatVersion;
	if (typeof version === "number" && version > PROMPT_FORMAT_VERSION) {
		throw new ChatStoreError(
			"too-new",
			"This prompt was saved by a newer version of the app.",
		);
	}
	const parsed = promptSchema.safeParse(raw);
	if (!parsed.success) {
		throw new ChatStoreError("invalid-chat", "A stored prompt is invalid.", {
			issues: issuesOf(parsed.error),
		});
	}
	return parsed.data;
}

/** A name as stored: trimmed, inner whitespace collapsed, "Untitled prompt" when empty. */
export function normalizeName(name: string): string {
	const clean = name.replace(/\s+/g, " ").trim();
	return (clean || "Untitled prompt").slice(0, MAX_PROMPT_NAME_LENGTH);
}

/** Tags as stored: lowercase, trimmed, a leading "#" dropped, no blanks or repeats. */
export function normalizeTags(tags: readonly string[]): string[] {
	const clean = tags
		.map((tag) =>
			tag
				.trim()
				.replace(/^#+/, "")
				.replace(/\s+/g, "-")
				.toLowerCase()
				.slice(0, MAX_TAG_LENGTH),
		)
		.filter((tag) => tag !== "");
	return [...new Set(clean)].slice(0, MAX_TAGS);
}

/** Comma-separated input: "Writing, code review, #tone" → ["writing", "code-review", "tone"]. */
export function parseTags(input: string): string[] {
	return normalizeTags(input.split(","));
}

export function currentVersion(prompt: Prompt): PromptVersion {
	return prompt.versions[prompt.versions.length - 1];
}

export function versionOf(
	prompt: Prompt,
	version: number,
): PromptVersion | undefined {
	return prompt.versions.find((entry) => entry.version === version);
}

export function newPrompt(input: {
	id: string;
	ownerId: string | null;
	name: string;
	tags: readonly string[];
	text: string;
	now: number;
}): Prompt {
	return {
		id: input.id,
		ownerId: input.ownerId,
		name: normalizeName(input.name),
		tags: normalizeTags(input.tags),
		versions: [{ version: 1, text: input.text, createdAt: input.now }],
		createdAt: input.now,
		updatedAt: input.now,
	};
}

function appendVersion(
	prompt: Prompt,
	entry: Omit<PromptVersion, "version">,
): Prompt {
	const version = currentVersion(prompt).version + 1;
	return {
		...prompt,
		versions: [...prompt.versions, { ...entry, version }].slice(-MAX_VERSIONS),
		updatedAt: entry.createdAt,
	};
}

/** The prompt with `text` as a new version. The same text as now adds nothing. */
export function withText(prompt: Prompt, text: string, now: number): Prompt {
	if (currentVersion(prompt).text === text) return prompt;
	return appendVersion(prompt, { text, createdAt: now });
}

/**
 * Restores `version` by adding its text again as the newest version, so nothing is lost. Restoring the
 * current text adds nothing. Throws for a version the prompt doesn't have.
 */
export function withRestored(
	prompt: Prompt,
	version: number,
	now: number,
): Prompt {
	const old = versionOf(prompt, version);
	if (!old) {
		throw new ChatStoreError("invalid-chat", "That version doesn't exist.");
	}
	if (currentVersion(prompt).text === old.text) return prompt;
	return appendVersion(prompt, {
		text: old.text,
		createdAt: now,
		restoredFrom: version,
	});
}

/** Renames and retags, without a new version. The same labels as now change nothing. */
export function withLabels(
	prompt: Prompt,
	labels: { name: string; tags: readonly string[] },
	now: number,
): Prompt {
	const name = normalizeName(labels.name);
	const tags = normalizeTags(labels.tags);
	if (name === prompt.name && tags.join("\n") === prompt.tags.join("\n")) {
		return prompt;
	}
	return { ...prompt, name, tags, updatedAt: now };
}

/** Whether `prompt` is the default for the model with `key`. */
export function isDefaultFor(prompt: Prompt, key: string): boolean {
	return prompt.defaultFor?.includes(key) === true;
}

/**
 * The prompt as the default for `key` (`on`) or not. Doesn't change `updatedAt`: it's a setting of
 * the model, not an edit of the prompt. Unchanged prompts come back as they are.
 */
export function withDefaultFor(
	prompt: Prompt,
	key: string,
	on: boolean,
): Prompt {
	if (isDefaultFor(prompt, key) === on) return prompt;
	const others = (prompt.defaultFor ?? []).filter((entry) => entry !== key);
	const next = on ? [...others, key].slice(-MAX_DEFAULT_MODELS) : others;
	const { defaultFor: _, ...rest } = prompt;
	return next.length > 0 ? { ...rest, defaultFor: next } : rest;
}
