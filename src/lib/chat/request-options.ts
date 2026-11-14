import type { ModelSelection } from "@/lib/chat/model-selection";
import type { RequestSettings } from "@/lib/params/request";

// What a send or a regenerate passes to `useChat`: where the request goes and its settings, read by
// `BrowserChatTransport` from the body. Undefined until there's somewhere to send.

export interface ChatRequestOptions {
	body: ModelSelection & { settings?: RequestSettings };
}

export function chatRequestOptions(
	selection: ModelSelection | undefined,
	settings: RequestSettings | undefined,
): ChatRequestOptions | undefined {
	return selection && { body: { ...selection, settings } };
}
