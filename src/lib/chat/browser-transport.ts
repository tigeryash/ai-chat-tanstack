import {
	type ChatTransport,
	convertToModelMessages,
	type LanguageModel,
	streamText,
	type UIMessage,
	type UIMessageChunk,
} from "ai";
import { getProviderKey } from "@/lib/keys";
import { logError } from "@/lib/log";
import {
	ChatSetupError,
	chatErrorLogFields,
	describeChatError,
} from "./chat-errors";
import { createLanguageModel } from "./language-model";
import {
	LOCAL_PROVIDER,
	type ModelSelection,
	modelSelectionSchema,
	providerName,
} from "./model-selection";

// The chat engine's transport (roadmap decision 7): `useChat` hands it the messages, and it runs
// `streamText` right here in the browser against the chosen provider. Nothing goes through our server.
// The provider and model come in each request's `body` (`sendMessage(…, { body: selection })`), so
// every pane can pick its own.

/** Saved on each reply, so a chat shows which model wrote what. */
export interface ReplyMetadata {
	provider: ModelSelection["provider"];
	model: string;
}

export type ResolveModel = (
	selection: ModelSelection,
) => Promise<LanguageModel>;

/** The real provider for `selection`, with the key from the vault. */
export const resolveProviderModel: ResolveModel = async (selection) => {
	if (selection.provider === LOCAL_PROVIDER) {
		return createLanguageModel(selection, null);
	}
	const key = await getProviderKey(selection.provider);
	if (!key) {
		throw new ChatSetupError(
			`There's no ${providerName(selection.provider)} key in this browser. Add one in Settings.`,
		);
	}
	return createLanguageModel(selection, key);
};

function parseSelection(body: object | undefined): ModelSelection {
	const parsed = modelSelectionSchema.safeParse(body);
	if (!parsed.success) {
		throw new ChatSetupError("Pick a provider and a model first.");
	}
	return parsed.data;
}

export class BrowserChatTransport implements ChatTransport<UIMessage> {
	readonly #resolveModel: ResolveModel;

	/** `resolveModel` swaps in a mock model for tests. */
	constructor(resolveModel: ResolveModel = resolveProviderModel) {
		this.#resolveModel = resolveModel;
	}

	async sendMessages({
		messages,
		abortSignal,
		body,
	}: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]): Promise<
		ReadableStream<UIMessageChunk>
	> {
		const selection = parseSelection(body);
		const name = providerName(selection.provider);
		const onError = (error: unknown) => {
			// Content-free on purpose (hard rule 4): no prompt, reply, or provider message.
			logError("Chat request failed:", {
				provider: selection.provider,
				...chatErrorLogFields(error),
			});
			return describeChatError(error, name);
		};

		try {
			const result = streamText({
				model: await this.#resolveModel(selection),
				messages: await convertToModelMessages(messages),
				abortSignal,
			});
			return result.toUIMessageStream({
				sendReasoning: true,
				sendSources: true,
				onError,
				messageMetadata: ({ part }): ReplyMetadata | undefined =>
					part.type === "start"
						? { provider: selection.provider, model: selection.model }
						: undefined,
			});
		} catch (error) {
			// useChat shows this error's message, so swap in the safe one.
			throw new ChatSetupError(onError(error));
		}
	}

	async reconnectToStream() {
		// Streams live in this tab; there's nothing on a server to resume.
		return null;
	}
}
