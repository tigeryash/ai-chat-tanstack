import { useSyncExternalStore } from "react";
import { PROVIDER_IDS, type ProviderId } from "@/lib/keys";
import { PROVIDERS } from "@/lib/keys/providers";
import { logWarn } from "@/lib/log";
import { z } from "@/lib/zod";

// Which provider and model a chat sends to. The picker (temporary until roadmap 2.2) remembers the
// last choice in this browser's localStorage. It holds no key and no chat content.

export const LOCAL_PROVIDER = "local";
export type ChatProviderId = ProviderId | typeof LOCAL_PROVIDER;

export const CHAT_PROVIDER_IDS = [...PROVIDER_IDS, LOCAL_PROVIDER] as const;

export function providerName(provider: ChatProviderId): string {
	return provider === LOCAL_PROVIDER
		? "the local server"
		: PROVIDERS[provider].name;
}

const MODEL_ID_MAX = 200;

/** What the picker holds. `model` is empty until the person picks or types one. */
export const modelChoiceSchema = z.object({
	provider: z.enum(CHAT_PROVIDER_IDS),
	model: z.string().trim().max(MODEL_ID_MAX),
});
export type ModelChoice = z.infer<typeof modelChoiceSchema>;

/** What a request needs: a choice with a model. The transport checks every request against it. */
export const modelSelectionSchema = modelChoiceSchema.extend({
	model: z.string().trim().min(1).max(MODEL_ID_MAX),
});
export type ModelSelection = z.infer<typeof modelSelectionSchema>;

export const MODEL_CHOICE_STORAGE_KEY = "highelo-model-choice";

const listeners = new Set<() => void>();
let loaded = false;
let current: ModelChoice | null = null;

function load(): ModelChoice | null {
	try {
		const raw = localStorage.getItem(MODEL_CHOICE_STORAGE_KEY);
		if (!raw) return null;
		const parsed = modelChoiceSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		// Blocked storage or bad JSON: start with no choice.
		return null;
	}
}

function notify() {
	for (const listener of listeners) listener();
}

/** The remembered choice, or null. Bad or old data reads as null. */
export function readModelChoice(): ModelChoice | null {
	if (!loaded) {
		current = load();
		loaded = true;
	}
	return current;
}

export function storeModelChoice(choice: ModelChoice): void {
	current = modelChoiceSchema.parse(choice);
	loaded = true;
	try {
		localStorage.setItem(MODEL_CHOICE_STORAGE_KEY, JSON.stringify(current));
	} catch (error) {
		// Private windows can refuse storage; the choice still holds for this page.
		logWarn("Couldn't remember the model choice:", error);
	}
	notify();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	// Another tab changed it.
	const onStorage = (event: StorageEvent) => {
		if (event.key !== MODEL_CHOICE_STORAGE_KEY) return;
		current = load();
		notify();
	};
	window.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", onStorage);
	};
}

/** The remembered choice, shared by every component that reads it, and a setter. */
export function useModelChoice() {
	const choice = useSyncExternalStore(subscribe, readModelChoice, () => null);
	return [choice, storeModelChoice] as const;
}

/** The choice as request options for `useChat`, or undefined while no model is picked. */
export function toSelection(
	choice: ModelChoice | null,
): ModelSelection | undefined {
	const parsed = modelSelectionSchema.safeParse(choice);
	return parsed.success ? parsed.data : undefined;
}
