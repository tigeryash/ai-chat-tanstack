import { PROVIDER_IDS, type ProviderId } from "@/lib/keys";
import { PROVIDERS } from "@/lib/keys/providers";
import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";

// Which provider and model a chat sends to. Each chat keeps its own choice (chat-model-choice.ts), and
// the last one picked, kept in this browser's localStorage, is the default for new chats. A choice
// holds no key and no chat content.

export const LOCAL_PROVIDER = "local";
export type ChatProviderId = ProviderId | typeof LOCAL_PROVIDER;

export const CHAT_PROVIDER_IDS = [...PROVIDER_IDS, LOCAL_PROVIDER] as const;

export function providerName(provider: ChatProviderId): string {
	return provider === LOCAL_PROVIDER
		? "the local server"
		: PROVIDERS[provider].name;
}

const MODEL_ID_MAX = 200;

/**
 * What the picker holds. `model` is the provider's own id for the model, empty until one is picked.
 * `gatewayId` is the catalog model it came from (absent for local and custom models), so the chat can
 * show its model card, or the removed-model banner once the catalog drops it.
 */
export const modelChoiceSchema = z.object({
	provider: z.enum(CHAT_PROVIDER_IDS),
	model: z.string().trim().max(MODEL_ID_MAX),
	gatewayId: z.string().max(MODEL_ID_MAX).optional(),
});
export type ModelChoice = z.infer<typeof modelChoiceSchema>;

/** What a request needs: a choice with a model. The transport checks every request against it. */
export const modelSelectionSchema = modelChoiceSchema.extend({
	model: z.string().trim().min(1).max(MODEL_ID_MAX),
});
export type ModelSelection = z.infer<typeof modelSelectionSchema>;

export const MODEL_CHOICE_STORAGE_KEY = "highelo-model-choice";

const lastChoice = createLocalStore<ModelChoice | null>(
	MODEL_CHOICE_STORAGE_KEY,
	modelChoiceSchema.nullable(),
	null,
);

/** The last choice in this browser, the default for new chats. Bad or old data reads as null. */
export function readModelChoice(): ModelChoice | null {
	return lastChoice.read();
}

export function storeModelChoice(choice: ModelChoice): void {
	lastChoice.write(choice);
}

/** The last choice, shared by every component that reads it, and a setter. */
export function useModelChoice() {
	return [lastChoice.use(), storeModelChoice] as const;
}

/** The choice as request options for `useChat`, or undefined while no model is picked. */
export function toSelection(
	choice: ModelChoice | null,
): ModelSelection | undefined {
	const parsed = modelSelectionSchema.safeParse(choice);
	return parsed.success ? parsed.data : undefined;
}
