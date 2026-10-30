import { useSyncExternalStore } from "react";
import { createLocalStore } from "@/lib/local-store";
import { logError } from "@/lib/log";
import {
	type ChatSettings,
	type ParamValues,
	paramValuesSchema,
} from "@/lib/params/settings";
import type { ChatStore } from "@/lib/storage/chat-store";
import { z } from "@/lib/zod";
import type { ModelChoice } from "./model-selection";

// Each chat's settings panel values and system prompt (roadmap 2.4b). A chat that has never had its
// own settings shows the last ones used with its model, and keeps them once it's sent, like its model
// choice. Open chats' settings live here; saved chats keep theirs in the ChatStore (an unsaved chat's
// are written when its first reply saves it, by `chat-sessions.ts`).
// The last-used values per model sit in localStorage: numbers and stop sequences only, never a prompt.

export const MODEL_PARAMS_KEY = "highelo-model-params";
/** Oldest models go first once there are more. */
const MAX_MODELS = 100;

const lastUsed = createLocalStore<[string, ParamValues][]>(
	MODEL_PARAMS_KEY,
	z.array(z.tuple([z.string().max(300), paramValuesSchema])),
	[],
);

/** What last-used settings are kept by: the catalog model, or the provider and model id. */
export function modelKey(choice: ModelChoice | null): string | undefined {
	if (!choice?.model) return undefined;
	return choice.gatewayId ?? `${choice.provider}:${choice.model}`;
}

function lastUsedFor(key: string | undefined): ParamValues | undefined {
	return key
		? lastUsed.read().find(([entry]) => entry === key)?.[1]
		: undefined;
}

function rememberParams(key: string | undefined, params: ParamValues) {
	if (!key) return;
	const others = lastUsed.read().filter(([entry]) => entry !== key);
	lastUsed.write(
		[...others, [key, params] as [string, ParamValues]].slice(-MAX_MODELS),
	);
}

// Replaced, never changed in place, so it works as a `useSyncExternalStore` snapshot (and the React
// Compiler, which memoizes on identity, sees every change).
let own: ReadonlyMap<string, ChatSettings> = new Map();
const listeners = new Set<() => void>();

function update(chatId: string, settings: ChatSettings | undefined) {
	const next = new Map(own);
	if (settings) next.set(chatId, settings);
	else next.delete(chatId);
	own = next;
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** A chat's own settings, if it has any. */
export function chatSettingsOf(chatId: string): ChatSettings | undefined {
	return own.get(chatId);
}

/** Called when a saved chat opens. */
export function loadChatSettings(
	chatId: string,
	settings: ChatSettings | undefined,
) {
	if (!settings || own.has(chatId)) return;
	update(chatId, settings);
}

/** What a chat sends: its own settings, else the last used with its model. */
export function effectiveChatSettings(
	chatId: string,
	key: string | undefined,
): ChatSettings {
	return own.get(chatId) ?? { params: lastUsedFor(key) ?? {} };
}

/** Keeps a chat's settings in this tab and, once it's saved, in the store. */
export function setChatSettings(
	chatId: string,
	settings: ChatSettings,
	store: ChatStore,
	key?: string,
) {
	update(chatId, settings);
	if (key) rememberParams(key, settings.params);
	persist(chatId, settings, store);
}

/** A chat that isn't saved yet gets its settings when its first reply saves it (chat-sessions.ts). */
function persist(chatId: string, settings: ChatSettings, store: ChatStore) {
	store
		.setSettings(chatId, settings)
		.catch((error) => logError("Couldn't save the chat's settings:", error));
}

/** On send: a chat without its own settings keeps the ones it was sent with. */
export function pinChatSettings(
	chatId: string,
	key: string | undefined,
	store: ChatStore,
) {
	if (own.has(chatId)) return;
	const settings = effectiveChatSettings(chatId, key);
	update(chatId, settings);
	persist(chatId, settings, store);
}

/** Forgets a chat's settings in this tab (after the chat is deleted). */
export function forgetChatSettings(chatId: string) {
	if (own.has(chatId)) update(chatId, undefined);
}

// A `use…` name so the React Compiler sees a hook: it memoized a bare `lastUsed.use()` call into a
// branch, which changed the hook order between renders.
function useLastUsedParams() {
	return lastUsed.use();
}

/** A chat's settings, re-rendering when they change, and whether they're its own yet. */
export function useChatSettings(chatId: string, key: string | undefined) {
	const settingsByChat = useSyncExternalStore(
		subscribe,
		() => own,
		() => own,
	);
	const params = useLastUsedParams();
	const fromModel = key
		? params.find(([entry]) => entry === key)?.[1]
		: undefined;
	const mine = settingsByChat.get(chatId);
	return {
		settings: mine ?? { params: fromModel ?? {} },
		isOwn: mine !== undefined,
	};
}
