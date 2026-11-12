import type { LanguageModel } from "ai";
import { getProviderKey } from "@/lib/keys";
import { localEndpointFor } from "@/lib/local-endpoints/endpoints";
import { ChatSetupError } from "./chat-errors";
import { createLanguageModel } from "./language-model";
import {
	LOCAL_PROVIDER,
	type ModelSelection,
	providerName,
} from "./model-selection";

// Part of the chat engine that loads on the first send (stream-reply.ts), not with the page.

/** The real provider for `selection`, with the key from the vault. */
export async function resolveProviderModel(
	selection: ModelSelection,
): Promise<LanguageModel> {
	if (selection.provider === LOCAL_PROVIDER) {
		const endpoint = localEndpointFor(selection.endpoint);
		if (!endpoint) {
			throw new ChatSetupError(
				selection.endpoint
					? "This chat's local server was removed in Settings. Pick another model."
					: "Add a local server (LM Studio or Ollama) in Settings first.",
			);
		}
		return createLanguageModel(selection, null, undefined, endpoint.baseUrl);
	}
	const key = await getProviderKey(selection.provider);
	if (!key) {
		throw new ChatSetupError(
			`There's no ${providerName(selection.provider)} key in this browser. Add one in Settings.`,
		);
	}
	return createLanguageModel(selection, key);
}
