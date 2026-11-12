import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { textFilesAsText } from "@/lib/attachments/text-file";
import { hostKey, recordHostResult } from "@/lib/hosts/host-failures";
import { localEndpointFor } from "@/lib/local-endpoints/endpoints";
import { logError } from "@/lib/log";
import { mergeProviderOptions, toCallParams } from "@/lib/params/mapping";
import { parseRequestSettings } from "@/lib/params/request";
import { developerOf, type ParamRoute } from "@/lib/params/routes";
import { z } from "@/lib/zod";
import { convertToModelMessages, streamText } from "./ai-engine";
import type { ReplyMetadata, ResolveModel } from "./browser-transport";
import {
	ChatSetupError,
	chatErrorLogFields,
	describeChatError,
} from "./chat-errors";
import {
	LOCAL_PROVIDER,
	type ModelSelection,
	modelSelectionSchema,
	providerName,
} from "./model-selection";
import { resolveProviderModel } from "./provider-model";

export { resolveProviderModel };

import { replyHostOf } from "./reply-host";
import { createReplyClock } from "./reply-stats";
import { routingOptions } from "./routing-options";

// The body of `BrowserChatTransport.sendMessages`, loaded on the first send so chat pages don't
// download streamText, the provider SDKs or the settings mapping before someone sends (ai-engine.ts).

type SendOptions = Parameters<ChatTransport<UIMessage>["sendMessages"]>[0];

/** Where the settings go: the route decides which settings exist and how they're sent. */
function paramRouteOf(selection: ModelSelection): ParamRoute {
	return {
		provider: selection.provider,
		endpointKind:
			selection.provider === LOCAL_PROVIDER
				? localEndpointFor(selection.endpoint)?.kind
				: undefined,
		developer: developerOf(selection.gatewayId),
	};
}

const replyIdSchema = z.object({ replyId: z.string().min(1).max(256) });

/**
 * The id the reply must get, when the request asks for one (`body.replyId`): regenerating into a
 * branch (roadmap R4) names the new reply up front, so its branch exists before it streams.
 */
function replyIdOf(body: object | undefined): string | undefined {
	const parsed = replyIdSchema.safeParse(body);
	return parsed.success ? parsed.data.replyId : undefined;
}

function parseSelection(body: object | undefined): ModelSelection {
	const parsed = modelSelectionSchema.safeParse(body);
	if (!parsed.success) {
		throw new ChatSetupError("Pick a provider and a model first.");
	}
	return parsed.data;
}

/** Streams the reply to `messages` from the model in `body`, in this tab. */
export async function streamReply(
	{ messages, abortSignal, body }: SendOptions,
	resolveModel: ResolveModel = resolveProviderModel,
	now?: () => number,
): Promise<ReadableStream<UIMessageChunk>> {
	const selection = parseSelection(body);
	const replyId = replyIdOf(body);
	const { params, support, systemPrompt, promptSource } = parseRequestSettings(
		(body as { settings?: unknown } | undefined)?.settings,
	);
	const call = toCallParams(paramRouteOf(selection), params, support);
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
		const model = await resolveModel(selection);
		// Text and code files go as text parts, which every model reads (roadmap 1.6b).
		const modelMessages = await convertToModelMessages(
			textFilesAsText(messages),
		);
		// Started once the key is read and the messages are converted, so TTFT is the provider's.
		const clock = createReplyClock(now);
		const result = streamText({
			model,
			...call.settings,
			...(systemPrompt !== undefined && { system: systemPrompt }),
			messages: modelMessages,
			providerOptions: mergeProviderOptions(
				routingOptions(selection),
				call.providerOptions,
			),
			abortSignal,
		});
		return result.toUIMessageStream({
			sendReasoning: true,
			sendSources: true,
			// The start chunk carries `replyId`, which the chat gives the reply it streams.
			...(replyId !== undefined && {
				originalMessages: messages,
				generateMessageId: () => replyId,
			}),
			onError,
			messageMetadata: ({ part }): Partial<ReplyMetadata> | undefined => {
				const stats = clock(part);
				if (stats) return stats;
				if (part.type === "start") {
					return {
						provider: selection.provider,
						model: selection.model,
						gatewayId: selection.gatewayId,
						upstream: selection.upstream,
						...(promptSource && { prompt: promptSource }),
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
