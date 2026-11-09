import type { ChatSettings } from "@/lib/params/settings";
import { currentVersion, type Prompt, versionOf } from "./prompt";

// Applying a saved prompt (roadmap 3.6) makes its text the chat's own system prompt (decision 19's pane
// override), leaving the chat's other settings alone. Which version a reply came from is 3.6b.

/** `settings` with `prompt`'s text (its current version, or `version`) as the system prompt. */
export function applyPrompt(
	settings: ChatSettings,
	prompt: Prompt,
	version?: number,
): ChatSettings {
	const entry =
		version === undefined ? currentVersion(prompt) : versionOf(prompt, version);
	if (!entry) throw new Error("That prompt version doesn't exist.");
	return { ...settings, systemPrompt: entry.text };
}
