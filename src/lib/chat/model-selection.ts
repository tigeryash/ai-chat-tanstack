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
const UPSTREAM_MAX = 100;
const ENDPOINT_ID_MAX = 64;

/**
 * What the picker holds. `model` is the provider's own id for the model, empty until one is picked.
 * `gatewayId` is the catalog model it came from (absent for local and custom models), so the chat can
 * show its model card, or the removed-model banner once the catalog drops it.
 */
export const modelChoiceSchema = z.object({
	provider: z.enum(CHAT_PROVIDER_IDS),
	model: z.string().trim().max(MODEL_ID_MAX),
	gatewayId: z.string().max(MODEL_ID_MAX).optional(),
	/**
	 * The upstream the user pinned on a router (roadmap 2.2b): an OpenRouter endpoint tag
	 * ("deepinfra/fp8") or an AI Gateway provider slug ("baseten"). Absent: the router picks.
	 */
	upstream: z.string().max(UPSTREAM_MAX).optional(),
	/**
	 * Let Auto pick the host for a catalog model, re-checked whenever connections or host status
	 * change. Choices saved before 2.2b have no flag and are treated as Auto too.
	 */
	autoHost: z.boolean().optional(),
	/**
	 * The saved local endpoint a local model runs on (roadmap 2.3), by id. Choices saved before 2.3
	 * have none and use the first saved endpoint.
	 */
	endpoint: z.string().max(ENDPOINT_ID_MAX).optional(),
});
export type ModelChoice = z.infer<typeof modelChoiceSchema>;

/** What Auto optimizes for. "reliable" leaves the router's own load balancing (uptime first). */
export const AUTO_SORTS = ["reliable", "cheapest", "fastest"] as const;
export type AutoSort = (typeof AUTO_SORTS)[number];

/** USD per million tokens. */
const pricingSchema = z.object({
	input: z.number().nonnegative().optional(),
	output: z.number().nonnegative().optional(),
});

/** What a request needs: a choice with a model. The transport checks every request against it. */
export const modelSelectionSchema = modelChoiceSchema.extend({
	model: z.string().trim().min(1).max(MODEL_ID_MAX),
	/** How a router (OpenRouter, AI Gateway) should pick when no upstream is pinned. */
	sort: z.enum(AUTO_SORTS).optional(),
	/** Only route to upstreams that don't train on prompts. */
	noTraining: z.boolean().optional(),
	/** The host's prices, for the reply's cost estimate. */
	pricing: pricingSchema.optional(),
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
	extras?: Pick<ModelSelection, "sort" | "noTraining" | "pricing">,
): ModelSelection | undefined {
	if (!choice) return undefined;
	const parsed = modelSelectionSchema.safeParse({ ...choice, ...extras });
	return parsed.success ? parsed.data : undefined;
}
