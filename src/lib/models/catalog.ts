import { useQuery } from "@tanstack/react-query";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type {
	CatalogModel,
	ModelParameters,
} from "../../../convex/lib/modelCatalog/view";

// The synced model catalog (roadmap 2.1) as the picker reads it. One HTTP query, not a live
// subscription: the table changes once a day, the app's sync client waits for a session
// (`expectAuth`) and chatting needs none (decision 4), and the e2e Convex stub can answer a plain
// POST with a seeded catalog.

export type { CatalogModel, ModelParameters };
export type ModelCatalog = FunctionReturnType<typeof api.models.list>;

const CATALOG_STALE_MS = 60 * 60 * 1000;

let client: ConvexHttpClient | undefined;
function catalogClient(): ConvexHttpClient {
	client ??= new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
	return client;
}

/** Every listed model, High Elo set marked. `data` is undefined while loading or after a failure. */
export function useModelCatalog() {
	return useQuery({
		queryKey: ["model-catalog"],
		queryFn: () => catalogClient().query(api.models.list, {}),
		staleTime: CATALOG_STALE_MS,
		retry: 2,
	});
}

/** One model by Gateway id, removed ones included, so a chat can say its model is gone. */
export function useCatalogModel(gatewayId: string | undefined) {
	return useQuery({
		queryKey: ["model-catalog", gatewayId],
		queryFn: () =>
			catalogClient().query(api.models.get, { gatewayId: gatewayId ?? "" }),
		enabled: gatewayId !== undefined,
		staleTime: CATALOG_STALE_MS,
	});
}

/** One model's parameter lists and reasoning options, for the settings panel (roadmap 2.4b). */
export function useModelParameters(gatewayId: string | undefined) {
	return useQuery({
		queryKey: ["model-parameters", gatewayId],
		queryFn: () =>
			catalogClient().query(api.models.parameters, {
				gatewayId: gatewayId ?? "",
			}),
		enabled: gatewayId !== undefined,
		staleTime: CATALOG_STALE_MS,
		retry: 2,
	});
}
