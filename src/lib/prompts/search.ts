import { currentVersion, type Prompt } from "./prompt";

// Searching the prompt library (roadmap 3.6), in memory: a library is small. Words in the query must
// all match the name, a tag, or the current text; a word starting with "#" must match a tag exactly.

function words(query: string): string[] {
	return query.toLowerCase().split(/\s+/).filter(Boolean);
}

function matches(prompt: Prompt, word: string): boolean {
	if (word.startsWith("#")) {
		const tag = word.slice(1);
		return tag === "" || prompt.tags.includes(tag);
	}
	return (
		prompt.name.toLowerCase().includes(word) ||
		prompt.tags.some((tag) => tag.includes(word)) ||
		currentVersion(prompt).text.toLowerCase().includes(word)
	);
}

/** Matching prompts, most recently changed first. */
export function searchPrompts(
	prompts: readonly Prompt[],
	query: string,
): Prompt[] {
	const wanted = words(query);
	return prompts
		.filter((prompt) => wanted.every((word) => matches(prompt, word)))
		.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Every tag in use, alphabetically. */
export function allTags(prompts: readonly Prompt[]): string[] {
	return [...new Set(prompts.flatMap((prompt) => prompt.tags))].sort();
}
