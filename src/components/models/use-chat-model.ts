import type { UIMessage } from "ai";
import { useChatModelChoice } from "@/lib/chat/chat-model-choice";
import { LOCAL_PROVIDER, type ModelChoice } from "@/lib/chat/model-selection";
import type { ProviderId } from "@/lib/keys/providers";
import { useConnectedProviders } from "@/lib/keys/use-connected-providers";
import {
	type CatalogModel,
	useCatalogModel,
	useModelCatalog,
} from "@/lib/models/catalog";
import { routesFor, routeToConnect } from "@/lib/models/runnability";
import { suggestReplacement } from "@/models/family";

// Everything a chat screen needs about its model (roadmap 2.1b/2.2): the chat's choice, its catalog
// model (looked up by id when the list no longer has it), whether the user can run it, and, for a
// removed model, the suggested replacement.

function choiceFor(
	model: CatalogModel,
	connected: ReadonlySet<ProviderId>,
): ModelChoice {
	const route = routesFor(model, connected)[0] ?? routeToConnect(model);
	return { ...route, gatewayId: model.gatewayId };
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
	return best ? choiceFor(best, connected) : null;
}

export function useChatModel(chatId: string, messages: readonly UIMessage[]) {
	const [stored, setChoice] = useChatModelChoice(chatId, messages);
	const catalog = useModelCatalog();
	const connected = useConnectedProviders();
	const models = catalog.data?.models;

	const choice = stored ?? defaultChoice(models, connected);
	const gatewayId = choice?.gatewayId;
	const listed = models?.find((model) => model.gatewayId === gatewayId);
	// Not in the list: removed (or hidden). Ask for it by id once the list has loaded.
	const lookup = useCatalogModel(models && !listed ? gatewayId : undefined);
	const chosenModel = listed ?? lookup.data ?? undefined;

	const replacement =
		chosenModel?.status === "removed" && models
			? suggestReplacement(chosenModel, models)
			: undefined;
	const runnable =
		choice !== null &&
		(choice.provider === LOCAL_PROVIDER ||
			connected?.has(choice.provider) === true);

	return {
		choice,
		setChoice,
		chosenModel,
		replacement,
		runnable,
		connected,
		catalog: {
			models,
			failed: catalog.isError,
			retry: () => void catalog.refetch(),
		},
		switchTo: (model: CatalogModel) =>
			setChoice(choiceFor(model, connected ?? new Set())),
	};
}
