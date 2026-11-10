import { readChatModelChoice } from "@/lib/chat/chat-model-choice";
import {
	effectiveChatSettings,
	modelKey,
	setChatSettings,
} from "@/lib/chat/chat-settings";
import { peekOpenChat } from "@/lib/chat/open-chats";
import type { ChatSettings } from "@/lib/params/settings";
import type { ChatStore } from "@/lib/storage/chat-store";

// "Copy settings to all panes" (roadmap 3.4): one pane's settings panel values and system prompt become
// every other pane's own, so a comparison runs the models under the same settings. Models stay as they
// are (panes hold their own, decision 16). A setting another pane's model doesn't take is kept but not
// sent (`params/mapping.ts` strips it), so switching that pane to a model that takes it still has it.

/** What a pane's chat sends now: its own settings, else the last ones used with its model. */
export function paneSettings(chatId: string): ChatSettings {
	const choice = readChatModelChoice(
		chatId,
		peekOpenChat(chatId)?.chat.messages,
	);
	return effectiveChatSettings(chatId, modelKey(choice));
}

/**
 * Gives every chat in `targets` (except the source) the source's settings. A chat that isn't saved yet
 * gets them when its first reply saves it. Returns how many panes were changed.
 */
export function copySettingsToPanes(
	sourceChatId: string,
	targets: readonly string[],
	store: ChatStore,
): number {
	const settings = paneSettings(sourceChatId);
	const others = targets.filter((id) => id !== sourceChatId);
	for (const chatId of others) {
		// No model key: copying shouldn't change the last-used settings of the other panes' models.
		setChatSettings(
			chatId,
			{
				params: { ...settings.params },
				...(settings.systemPrompt !== undefined && {
					systemPrompt: settings.systemPrompt,
				}),
				...(settings.systemPromptSource && {
					systemPromptSource: { ...settings.systemPromptSource },
				}),
			},
			store,
		);
	}
	return others.length;
}
