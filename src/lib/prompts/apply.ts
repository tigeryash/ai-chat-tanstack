import type { ChatSettings } from "@/lib/params/settings";
import { currentVersion, type Prompt, versionOf } from "./prompt";

// Applying a saved prompt (roadmap 3.6) makes its text the chat's own system prompt (decision 19's pane
// override), leaving the chat's other settings alone. It remembers which version it was (3.6b), so the
// chat's replies record it until the text is edited by hand.

/** `settings` with `prompt`'s text (its current version, or `version`) as the system prompt. */
export function applyPrompt(
	settings: ChatSettings,
	prompt: Prompt,
	version?: number,
): ChatSettings {
	const entry =
		version === undefined ? currentVersion(prompt) : versionOf(prompt, version);
	if (!entry) throw new Error("That prompt version doesn't exist.");
	return {
		...settings,
		systemPrompt: entry.text,
		systemPromptSource: { promptId: prompt.id, version: entry.version },
	};
}
