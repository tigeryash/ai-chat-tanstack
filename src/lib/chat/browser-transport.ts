import {
	type ChatTransport,
	convertToModelMessages,
	type LanguageModel,
	streamText,
	type UIMessage,
	type UIMessageChunk,
} from "ai";
import { hostKey, recordHostResult } from "@/lib/hosts/host-failures";
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
import { type ReplyHost, replyHostOf } from "./reply-host";
import { routingOptions } from "./routing-options";

// The chat engine's transport (roadmap decision 7): `useChat` hands it the messages, and it runs
// `streamText` right here in the browser against the chosen provider. Nothing goes through our server.
// The provider and model come in each request's `body` (`sendMessage(…, { body: selection })`), so
// every pane can pick its own.

/**
 * Saved on each reply, so a chat shows which model wrote what, which host answered (roadmap 2.2b)
 * and what it cost. Every field after `gatewayId` is optional, so older replies still read.
 */
export interface ReplyMetadata extends ReplyHost {
	provider: ModelSelection["provider"];
	model: string;
	/** The catalog model, when it was picked from the catalog. */
	gatewayId?: string;
	/** The upstream the request pinned on a router. */
	upstream?: string;
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
		const host = hostKey(selection.provider, selection.upstream);
		const onError = (error: unknown) => {
			const fields = chatErrorLogFields(error);
			// Content-free on purpose (hard rule 4): no prompt, reply, or provider message.
			logError("Chat request failed:", {
				provider: selection.provider,
				...fields,
			});
			if (fields.status !== undefined || error instanceof TypeError) {
				recordHostResult(host, { ok: false, status: fields.status });
			}
			return describeChatError(error, name);
		};

		try {
			const result = streamText({
				model: await this.#resolveModel(selection),
				messages: await convertToModelMessages(messages),
				providerOptions: routingOptions(selection),
				abortSignal,
			});
			return result.toUIMessageStream({
				sendReasoning: true,
				sendSources: true,
				onError,
				messageMetadata: ({ part }): Partial<ReplyMetadata> | undefined => {
					if (part.type === "start") {
						return {
							provider: selection.provider,
							model: selection.model,
							gatewayId: selection.gatewayId,
							upstream: selection.upstream,
						};
					}
					if (part.type === "finish-step") {
						recordHostResult(host, { ok: true });
						return replyHostOf(selection, part);
					}
					return undefined;
				},
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
