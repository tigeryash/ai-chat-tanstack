import type { ChatModel } from "@/components/models/use-chat-model";
import { chatStore } from "@/lib/chat/chat-sessions";
import {
	modelKey,
	pinChatSettings,
	setChatSettings,
	useChatSettings,
} from "@/lib/chat/chat-settings";
import { LOCAL_PROVIDER } from "@/lib/chat/model-selection";
import {
	saveDefaultSystemPrompt,
	systemPromptFor,
	useDefaultSystemPrompt,
} from "@/lib/chat/system-prompt";
import { useLocalEndpointFor } from "@/lib/local-endpoints/endpoints";
import { useModelParameters } from "@/lib/models/catalog";
import type { RequestSettings } from "@/lib/params/request";
import { developerOf } from "@/lib/params/routes";
import type { ChatSettings } from "@/lib/params/settings";
import { NO_SUPPORT, paramSupport } from "@/lib/params/support";

// A chat's settings panel state (roadmap 2.4b): its values, what its model and host support, the
// shared system prompt, and what the next request carries.

export function useChatParams(chatId: string, model: ChatModel) {
	const { choice } = model;
	const store = chatStore();
	const key = modelKey(choice);
	const { settings, isOwn } = useChatSettings(chatId, key);
	const sharedPrompt = useDefaultSystemPrompt(store);
	const isLocal = choice?.provider === LOCAL_PROVIDER;
	const endpoint = useLocalEndpointFor(isLocal ? choice.endpoint : undefined);
	const gatewayId = isLocal ? undefined : choice?.gatewayId;
	const catalog = useModelParameters(gatewayId);

	const support = choice?.model
		? paramSupport({
				provider: choice.provider,
				endpointKind: isLocal ? endpoint?.kind : undefined,
				developer: developerOf(gatewayId),
				gatewayId,
				catalog: catalog.data,
			})
		: NO_SUPPORT;
	const request: RequestSettings = {
		params: settings.params,
		support,
		systemPrompt: systemPromptFor(settings.systemPrompt, sharedPrompt),
	};

	return {
		settings,
		/** The chat has settings of its own (otherwise it shows the last ones used with its model). */
		isOwn,
		support,
		/** Still waiting for the catalog's parameter lists. */
		loading: catalog.isLoading,
		sharedPrompt,
		request,
		update: (next: ChatSettings) => setChatSettings(chatId, next, store, key),
		setSharedPrompt: (prompt: string) => saveDefaultSystemPrompt(prompt, store),
		/** On send: the chat keeps the settings it was sent with. */
		pin: () => pinChatSettings(chatId, key, store),
	};
}

export type ChatParams = ReturnType<typeof useChatParams>;
