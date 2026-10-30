import {
	LOCAL_PROVIDER,
	type ModelChoice,
	providerName,
} from "@/lib/chat/model-selection";
import type { ProviderId } from "@/lib/keys/providers";
import type { CatalogModel } from "@/lib/models/catalog";
import { filterModels, type PickerFilters } from "@/lib/models/picker-filter";
import { routesFor } from "@/lib/models/runnability";
import type { CatalogEntry, CustomTarget } from "./model-picker-list";
import type { LocalEndpointModels } from "./use-local-models";

// The open picker's rows. Called only from the picker's panel, which mounts while the picker is open,
// so a closed picker does no catalog work (filtering and routing ~270 models).

/** The route to keep when re-picking: the chosen provider if it still serves the model. */
function entryFor(
	model: CatalogModel,
	connected: ReadonlySet<ProviderId>,
	choice: ModelChoice | null,
): CatalogEntry {
	const routes = routesFor(model, connected);
	const current =
		choice?.gatewayId === model.gatewayId
			? routes.find((route) => route.provider === choice.provider)
			: undefined;
	return { model, route: current ?? routes[0] };
}

export function usePickerEntries({
	models,
	filters,
	connected,
	choice,
	localEndpoints,
}: {
	models: readonly CatalogModel[];
	filters: PickerFilters;
	connected: ReadonlySet<ProviderId>;
	choice: ModelChoice | null;
	localEndpoints: readonly LocalEndpointModels[];
}): { entries: CatalogEntry[]; customTargets: CustomTarget[] } {
	const entries = filterModels(models, filters).map((model) =>
		entryFor(model, connected, choice),
	);
	const customTargets: CustomTarget[] = [
		...[...connected].map(
			(provider): CustomTarget => ({
				key: provider,
				label: providerName(provider),
				logo: provider,
				choice: { provider },
			}),
		),
		...localEndpoints.map(
			({ endpoint }): CustomTarget => ({
				key: endpoint.id,
				label: endpoint.name,
				logo: LOCAL_PROVIDER,
				choice: { provider: LOCAL_PROVIDER, endpoint: endpoint.id },
			}),
		),
	];
	return { entries, customTargets };
}
