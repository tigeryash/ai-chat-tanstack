import { type LanguageModel, streamText, type UIMessage } from "ai";
import type { ResolveModel } from "./browser-transport";
import { TITLE_MAX_LENGTH, titleFromMessages } from "./chat-title";
import { type ModelChoice, toSelection } from "./model-selection";

// Writes a new chat's title with the title model (roadmap R2 S2, setting in `title-model.ts`). The
// first message goes, once, to the chosen model, in this browser with the user's own key (resolved
// like any chat request, `resolveAppModel`). Anything going wrong falls back to the first line
// quietly. Neither the message nor the title is logged or tracked (hard rule 4).

/** How long a title may take before the first line is used instead. */
export const TITLE_TIMEOUT_MS = 15_000;
/** Only the start of a long first message is sent. */
const PROMPT_MAX_CHARS = 2000;
const TITLE_MAX_WORDS = 8;

const TITLE_INSTRUCTIONS = `Write a short title, at most ${TITLE_MAX_WORDS} words, for a chat that starts with the user's message. Reply with the title only: no quotes, no trailing punctuation, no explanation.`;

/** The first user message's text, as the title model reads it. */
function firstMessageText(messages: readonly UIMessage[]): string {
	const first = messages.find((message) => message.role === "user");
	return (first?.parts ?? [])
		.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("\n")
		.trim()
		.slice(0, PROMPT_MAX_CHARS);
}

/** A model's reply as a title: its first line, without quotes, a "Title:" prefix or a final period. */
export function cleanTitle(raw: string): string {
	const line =
		raw
			.split("\n")
			.map((candidate) => candidate.trim())
			.find((candidate) => candidate.length > 0) ?? "";
	const cleaned = line
		.replace(/^(#+\s*)?(title\s*:\s*)?/i, "")
		.replace(/[.。]+$/, "")
		.replace(/^["'“‘*`]+|["'”’*`]+$/g, "")
		.replace(/[.。]+$/, "")
		.trim();
	return cleaned.length > TITLE_MAX_LENGTH
		? `${cleaned.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`
		: cleaned;
}

async function askForTitle(
	model: LanguageModel,
	text: string,
	timeoutMs: number,
): Promise<string> {
	const result = streamText({
		model,
		system: TITLE_INSTRUCTIONS,
		prompt: text,
		abortSignal: AbortSignal.timeout(timeoutMs),
		// Errors surface through `text` below; the default handler would log the provider's message.
		onError: () => {},
	});
	return cleanTitle(await result.text);
}

/**
 * The title for a new chat: written by `choice` when there is one, else (and whenever that fails,
 * times out or comes back empty) the first line of the first message.
 */
export async function writeChatTitle({
	messages,
	choice,
	resolveModel,
	timeoutMs = TITLE_TIMEOUT_MS,
}: {
	messages: readonly UIMessage[];
	choice: ModelChoice | null;
	resolveModel: ResolveModel;
	timeoutMs?: number;
}): Promise<string> {
	const fallback = titleFromMessages(messages);
	const selection = toSelection(choice);
	const text = firstMessageText(messages);
	if (!selection || !text) return fallback;
	try {
		const model = await resolveModel(selection);
		return (await askForTitle(model, text, timeoutMs)) || fallback;
	} catch {
		// No key, no server, a failed request or a timeout: the first line, quietly (nothing logged,
		// so no prompt or provider message can reach the logs).
		return fallback;
	}
}
