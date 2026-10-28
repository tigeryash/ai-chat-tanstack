import type { UIMessage } from "ai";
import { useChatModelChoice } from "@/lib/chat/chat-model-choice";
import {
	type AutoSort,
	LOCAL_PROVIDER,
	type ModelChoice,
	type ModelSelection,
	toSelection,
} from "@/lib/chat/model-selection";
import { useHostFailures } from "@/lib/hosts/host-failures";
import { type HostOption, hostOptionsFor } from "@/lib/hosts/host-options";
import { useHostPrefs } from "@/lib/hosts/host-prefs";
import {
	chatNeeds,
	type ResolvedHost,
	resolveHost,
	selectionExtras,
} from "@/lib/hosts/resolve-host";
import { useHostData } from "@/lib/hosts/use-endpoints";
import type { ProviderId } from "@/lib/keys/providers";
import { useConnectedProviders } from "@/lib/keys/use-connected-providers";
import {
	type CatalogModel,
	useCatalogModel,
	useModelCatalog,
} from "@/lib/models/catalog";
import { routesFor } from "@/lib/models/runnability";
import { suggestReplacement } from "@/models/family";

// Everything a chat screen needs about its model (roadmap 2.1b/2.2/2.2b): the chat's choice, its
// catalog model (looked up by id when the list no longer has it), the hosts that can run it, where the
// request goes now, and, for a removed model, the suggested replacement.

/** A catalog model with Auto picking the host. Resolved against connections on every render. */
function autoChoiceFor(model: CatalogModel): ModelChoice {
	const route = routesFor(model, new Set())[0];
	return {
		provider: route?.provider ?? "openrouter",
		model: route?.model ?? model.openRouterId ?? model.gatewayId,
		gatewayId: model.gatewayId,
		autoHost: true,
	};
}

/** With no choice yet: the best High Elo model the user can run. */
function defaultChoice(
	models: readonly CatalogModel[] | undefined,
	connected: ReadonlySet<ProviderId> | null,
): ModelChoice | null {
	if (!models || !connected || connected.size === 0) return null;
	const best = models
		.filter((model) => model.highElo && routesFor(model, connected).length > 0)
		.sort(
			(a, b) => (b.intelligenceIndex ?? -1) - (a.intelligenceIndex ?? -1),
		)[0];
	return best ? autoChoiceFor(best) : null;
}

/**
 * A catalog model waits for the catalog and the keys before it resolves (and can be sent), so a stale
 * host is never used in the meantime. Local and typed model ids go as they are.
 */
function resolveWanted({
	wanted,
	chosenModel,
	connected,
	hosts,
	sort,
	catalogFailed,
}: {
	wanted: ModelChoice | null;
	chosenModel: CatalogModel | undefined;
	connected: ReadonlySet<ProviderId> | null;
	hosts: readonly HostOption[];
	sort: AutoSort;
	catalogFailed: boolean;
}): ResolvedHost | null {
	if (!wanted) return null;
	const fromCatalog =
		wanted.gatewayId !== undefined && wanted.provider !== LOCAL_PROVIDER;
	if (!fromCatalog) return { choice: wanted, option: undefined };
	if (!connected) return null;
	if (chosenModel) return resolveHost(wanted, chosenModel, hosts, sort);
	return catalogFailed ? { choice: wanted, option: undefined } : null;
}

export function useChatModel(chatId: string, messages: readonly UIMessage[]) {
	const [stored, setChoice] = useChatModelChoice(chatId, messages);
	const catalog = useModelCatalog();
	const connected = useConnectedProviders();
	const failures = useHostFailures();
	const [prefs] = useHostPrefs();
	const models = catalog.data?.models;

	const wanted = stored ?? defaultChoice(models, connected);
	const gatewayId = wanted?.gatewayId;
	const listed = models?.find((model) => model.gatewayId === gatewayId);
	// Not in the list: removed (or hidden). Ask for it by id once the list has loaded.
	const lookup = useCatalogModel(models && !listed ? gatewayId : undefined);
	const chosenModel = listed ?? lookup.data ?? undefined;
	// Only what the picker already loaded: opening a chat fetches nothing from the routers.
	const hostData = useHostData(chosenModel, false);
	const needs = chatNeeds(messages);

	const hosts: HostOption[] =
		chosenModel && connected
			? hostOptionsFor({
					model: chosenModel,
					connected,
					data: hostData,
					failures,
					prefs,
					needs,
				})
			: [];
	const resolved = resolveWanted({
		wanted,
		chosenModel,
		connected,
		hosts,
		sort: prefs.autoSort,
		catalogFailed: catalog.isError || lookup.isError,
	});
	const choice = resolved?.choice ?? null;

	const replacement =
		chosenModel?.status === "removed" && models
			? suggestReplacement(chosenModel, models)
			: undefined;
	const runnable =
		choice !== null &&
		(choice.provider === LOCAL_PROVIDER ||
			connected?.has(choice.provider) === true);
	const selection: ModelSelection | undefined =
		resolved?.option && chosenModel
			? toSelection(choice, selectionExtras(resolved, chosenModel, prefs))
			: toSelection(choice);

	return {
		choice,
		/** What the user picked, before resolving: Auto or a pinned host. */
		wanted,
		selection,
		setChoice,
		chosenModel,
		replacement,
		runnable,
		connected,
		hosts,
		host: resolved?.option,
		needs,
		catalog: {
			models,
			failed: catalog.isError,
			retry: () => void catalog.refetch(),
		},
		/** Picks another catalog model; Auto picks its host once keys are known. */
		switchTo: (model: CatalogModel) => setChoice(autoChoiceFor(model)),
	};
}

export type ChatModel = ReturnType<typeof useChatModel>;
export { autoChoiceFor };
