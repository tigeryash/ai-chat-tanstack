import { currentVersion, isDefaultFor, type Prompt } from "./prompt";
import type { PromptSource } from "./provenance";

// Which system prompt a chat sends (roadmap 3.6b, decision 19): the chat's (pane's) own prompt, else
// its model's default prompt from the library, else the shared prompt. A model's default is a link to
// a saved prompt, followed live: editing the prompt changes what every chat without its own prompt
// sends next, and deleting it falls back to the shared prompt. Each reply records the version it used.

export interface ResolvedSystemPrompt {
	/** What to send; empty means none. */
	text: string;
	/** The saved prompt version it is, when it came from the library. */
	source?: PromptSource;
	/** Where it came from, for the settings panel. */
	from: "chat" | "model-default" | "shared" | "none";
}

/**
 * The default prompt for the model with `key` among `prompts` (already only the viewer's). If two
 * claim it (an import, two tabs), the most recently changed one wins, as `listPrompts` sorts them.
 */
export function modelDefaultPrompt(
	prompts: readonly Prompt[],
	key: string | undefined,
): Prompt | undefined {
	if (!key) return undefined;
	return [...prompts]
		.sort((a, b) => b.updatedAt - a.updatedAt)
		.find((prompt) => isDefaultFor(prompt, key));
}

export function resolveSystemPrompt(input: {
	own: string | undefined;
	ownSource: PromptSource | undefined;
	modelDefault: Prompt | undefined;
	shared: string;
}): ResolvedSystemPrompt {
	if (input.own !== undefined) {
		return {
			text: input.own,
			from: "chat",
			...(input.ownSource && { source: input.ownSource }),
		};
	}
	if (input.modelDefault) {
		const version = currentVersion(input.modelDefault);
		return {
			text: version.text,
			from: "model-default",
			source: { promptId: input.modelDefault.id, version: version.version },
		};
	}
	return input.shared.trim() === ""
		? { text: "", from: "none" }
		: { text: input.shared, from: "shared" };
}
