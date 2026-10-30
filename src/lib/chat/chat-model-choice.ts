import type { UIMessage } from "ai";
import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";
import type { ReplyMetadata } from "./browser-transport";
import {
	type ModelChoice,
	modelChoiceSchema,
	readModelChoice,
	storeModelChoice,
	useModelChoice,
} from "./model-selection";

// Each chat's model choice (roadmap 2.2). Picking a model stores it for that chat and makes it the
// default for new chats. Kept in localStorage by chat id, newest last, so a chat picks up where it
// was left even before its first reply is saved. Replies also carry their model in their metadata,
// which covers chats whose entry was trimmed or that came in through an import.

export const CHAT_MODEL_CHOICES_KEY = "highelo-chat-models";
/** Oldest entries go first once there are more. */
const MAX_CHATS = 500;

const entrySchema = z.tuple([z.string().max(100), modelChoiceSchema]);
const choices = createLocalStore<[string, ModelChoice][]>(
	CHAT_MODEL_CHOICES_KEY,
	z.array(entrySchema),
	[],
);

function storedChoice(
	entries: readonly [string, ModelChoice][],
	chatId: string,
) {
	return entries.find(([id]) => id === chatId)?.[1];
}

/** The model of the newest reply that says which model wrote it. */
export function lastReplyChoice(
	messages: readonly UIMessage[],
): ModelChoice | undefined {
	for (const message of [...messages].reverse()) {
		if (message.role !== "assistant") continue;
		const parsed = modelChoiceSchema.safeParse(
			message.metadata as Partial<ReplyMetadata> | undefined,
		);
		if (parsed.success) return parsed.data;
	}
	return undefined;
}

export function storeChatModelChoice(chatId: string, choice: ModelChoice) {
	const others = choices.read().filter(([id]) => id !== chatId);
	choices.write(
		[...others, [chatId, choice] as [string, ModelChoice]].slice(-MAX_CHATS),
	);
	storeModelChoice(choice);
}

/** This chat's choice: its own, else its last reply's model, else the last choice in this browser. */
export function readChatModelChoice(
	chatId: string,
	messages: readonly UIMessage[] = [],
): ModelChoice | null {
	return (
		storedChoice(choices.read(), chatId) ??
		lastReplyChoice(messages) ??
		readModelChoice()
	);
}

/** A chat's model choice and its setter. `replyChoice` is `lastReplyChoice` of its messages. */
export function useChatModelChoice(
	chatId: string,
	replyChoice: ModelChoice | undefined,
) {
	const entries = choices.use();
	const [lastChoice] = useModelChoice();
	const choice = storedChoice(entries, chatId) ?? replyChoice ?? lastChoice;
	const setChoice = (next: ModelChoice) => storeChatModelChoice(chatId, next);
	return [choice, setChoice] as const;
}
